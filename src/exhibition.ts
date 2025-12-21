import { Hono } from 'hono'
import { env } from 'hono/adapter'
import { apifyResponseSchema, type Museum } from './schema.js'
import apifyClient from './lib/apify.js'
import db from './lib/firestore.js'
import { Timestamp } from '@google-cloud/firestore'
import { TZDate } from '@date-fns/tz'
import { getDocumentHash } from './utils/hash.js'

const app = new Hono()

app.post('/scrape', async (c) => {
  const { APIFY_ACTOR_ID, OPENAI_API_KEY } = env<{
    APIFY_ACTOR_ID: string
    OPENAI_API_KEY: string
  }>(c)

  // Fetch museum scrape URLs from Firestore
  const museumCollectionRef = db.collection('museum')
  const museumSnapshot = await museumCollectionRef.get()
  const startUrls = museumSnapshot.docs.map((doc) => {
    const data = doc.data() as Museum
    return {
      url: data.scrapeUrl,
      method: 'GET' as const,
    }
  })

  const input = {
    excludeUrlGlobs: [
      {
        glob: '',
      },
    ],
    instructions:
      '開催中、開催予定の「展覧会」の情報を取得して、指定されたJSONの形式で出力して下さい。「常設展」の情報はJSONに含めないでください。`startDate`と`endDate`は`yyyy-mm-dd`形式で出力して下さい。`officialUrl`と`imageUrl`は`https`始まりの代表画像のURLを出力して下さい。情報が見つからない場合は空文字列を出力して下さい。',
    linkSelector: 'a[href]',
    maxCrawlingDepth: 2,
    maxPagesPerCrawl: 100,
    model: 'gpt-4o-mini',
    openaiApiKey: OPENAI_API_KEY,
    proxyConfiguration: {
      useApifyProxy: true,
      apifyProxyGroups: [],
    },
    removeElementsCssSelector: 'script, style, noscript, path, svg, xlink',
    removeLinkUrls: false,
    saveSnapshots: true,
    schema: {
      title: 'ExhibitionListSchema',
      type: 'object',
      properties: {
        exhibitions: {
          type: 'array',
          description: '展覧会情報の一覧',
          items: {
            type: 'object',
            properties: {
              title: {
                type: 'string',
                description: '展覧会のタイトル',
              },
              venue: {
                type: 'string',
                description: '美術館名',
              },
              startDate: {
                type: 'string',
                description: '展覧会の開始日時',
              },
              endDate: {
                type: 'string',
                description: '展覧会の終了日時',
              },
              officialUrl: {
                type: 'string',
                description: '展覧会の公式URL',
              },
              imageUrl: {
                type: 'string',
                description: '展覧会の代表画像URL',
              },
            },
            additionalProperties: false,
          },
        },
      },
    },
    startUrls,
    useStructureOutput: true,
  }

  console.log('Starting Actor: ', APIFY_ACTOR_ID)
  const run = await apifyClient.actor(APIFY_ACTOR_ID).call(input, {
    timeout: 300,
  })

  const { items: response } = await apifyClient.dataset(run.defaultDatasetId).listItems()

  const transformed = apifyResponseSchema.parse(response)
  console.log('Transformed data: ', transformed)

  const exhibitionCollectionRef = db.collection('exhibition')

  // Fetch existing document hashes to avoid duplicates
  const existingDocumentHashSet = new Set<string>()
  const existingDocumentsSnapshot = await exhibitionCollectionRef.get()
  existingDocumentsSnapshot.forEach((doc) => {
    existingDocumentHashSet.add(doc.id)
  })

  for (const exhibition of transformed) {
    const hash = getDocumentHash(exhibition.title, exhibition.venue)

    // Skip if document with the same hash already exists
    if (existingDocumentHashSet.has(hash)) {
      console.log(`Skipping duplicate document with hash: ${hash}`)
      continue
    }

    await exhibitionCollectionRef
      .doc(hash)
      .set(
        {
          title: exhibition.title,
          venue: exhibition.venue,
          startDate: exhibition.startDate
            ? Timestamp.fromDate(new TZDate(exhibition.startDate, 'Asia/Tokyo'))
            : '',
          endDate: exhibition.endDate
            ? Timestamp.fromDate(new TZDate(exhibition.endDate, 'Asia/Tokyo'))
            : '',
          officialUrl: exhibition.officialUrl,
          imageUrl: exhibition.imageUrl,
          status: 'pending',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        },
        { merge: false },
      )
      .then(() => {
        console.log(`Added document with hash: ${hash}`)
      })
  }

  return c.text(`Scrape successful. Found ${transformed.length} exhibitions.`, 201)
})

export default app
