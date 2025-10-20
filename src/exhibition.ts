import { Hono } from 'hono'
import { env } from 'hono/adapter'
import { apifyResponseSchema } from './schema.js'
import apifyClient from './lib/apify.js'
import db from './lib/firestore.js'
import { Timestamp } from '@google-cloud/firestore'
import { TZDate } from '@date-fns/tz'
import crypto from 'crypto'

const app = new Hono()

app.post('/scrape', async (c) => {
  const { APIFY_ACTOR_ID, OPENAI_API_KEY } = env<{
    APIFY_ACTOR_ID: string
    OPENAI_API_KEY: string
  }>(c)

  const input = {
    excludeUrlGlobs: [
      {
        glob: '',
      },
    ],
    instructions:
      '開催中、開催予定の「企画展」、「特別展」の情報を取得して、指定されたJSONの形式で出力して下さい。「常設展」の情報はJSONに含めないでください。`startDate`と`endDate`は`yyyy-mm-dd`形式で出力して下さい。',
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
          description: '展示会情報の一覧',
          items: {
            type: 'object',
            properties: {
              title: {
                type: 'string',
                description: '企画展のタイトル',
              },
              venue: {
                type: 'string',
                description: '美術館名',
              },
              startDate: {
                type: 'string',
                description: '企画展の開始日時',
              },
              endDate: {
                type: 'string',
                description: '企画展の終了日時',
              },
            },
            additionalProperties: false,
          },
        },
      },
    },
    startUrls: [
      {
        url: 'https://www.nmwa.go.jp/jp/exhibitions/current.html',
        method: 'GET',
      },
      {
        url: 'https://www.nact.jp/exhibition_special/',
        method: 'GET',
      },
      {
        url: 'https://www.tobikan.jp/exhibition/index.html',
        method: 'GET',
      },
    ],
    useStructureOutput: true,
  }

  console.log('Starting Actor: ', APIFY_ACTOR_ID)
  const run = await apifyClient.actor(APIFY_ACTOR_ID).call(input)

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

function getDocumentHash(title: string, venue: string): string {
  // Remove all whitespace characters for consistent hashing
  const cleanedTitle = title.replace(/\s+/g, '')
  const cleanedVenue = venue.replace(/\s+/g, '')

  return crypto.createHash('md5').update(`${cleanedTitle}_${cleanedVenue}`).digest('hex')
}
