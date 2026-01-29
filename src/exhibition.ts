import { Hono } from 'hono'
import { env } from 'hono/adapter'
import { apifyResponseSchema, apifyResponseWithoutUrlSchema, type Museum } from './schema.js'
import apifyClient from './lib/apify.js'
import db from './lib/firestore.js'
import { Timestamp } from '@google-cloud/firestore'
import { TZDate } from '@date-fns/tz'
import { getExhibitionDocumentId } from './utils/hash.js'
import { areDatesEqual } from './utils/date.js'

const app = new Hono()

app.post('/scrape', async (c) => {
  const { APIFY_ACTOR_ID, OPENAI_API_KEY } = env<{
    APIFY_ACTOR_ID: string
    OPENAI_API_KEY: string
  }>(c)

  // Fetch museum scrape URLs from Firestore
  const museumSnapshot = await db.collection('museum').where('scrapeEnabled', '==', true).get()
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
      '開催中、開催予定の「展覧会」の情報を取得して、指定されたJSONの形式で出力して下さい。「常設展」の情報はJSONに含めないでください。',
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
                description: '会場名',
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
    schemaDescription:
      '`title`の先頭に「特別展」「企画展」などの余計な単語を付け加えないでください。`startDate`と`endDate`は`yyyy-mm-dd`形式で出力して下さい。`officialUrl`と`imageUrl`は`https`始まりの代表画像のURLを出力して下さい。`venue`は美術館、博物館の名称を出力して下さい。例えば、`venue`には「本館展示室」「企画展示室」ではなく「国立西洋美術館」を出力して下さい。情報が見つからない場合は空文字列を出力して下さい。',
    startUrls,
    useStructureOutput: true,
  }

  console.log('Starting Actor: ', APIFY_ACTOR_ID)
  const run = await apifyClient.actor(APIFY_ACTOR_ID).call(input, {
    timeout: 300,
  })

  const { items: response } = await apifyClient.dataset(run.defaultDatasetId).listItems()
  const transformed = apifyResponseSchema.parse(response)

  const exhibitionCollectionRef = db.collection('exhibition')

  // Fetch existing documents to check for duplicates and date changes
  const existingExhibitionsMap = new Map<
    string,
    {
      startDate: Timestamp | string
      endDate: Timestamp | string
    }
  >()
  const existingDocumentsSnapshot = await exhibitionCollectionRef.get()
  existingDocumentsSnapshot.forEach((doc) => {
    const data = doc.data()
    existingExhibitionsMap.set(doc.id, {
      startDate: data.startDate,
      endDate: data.endDate,
    })
  })

  const museumAliasToMuseumNameMap = new Map<string, string>()
  const museumNameToMuseumIdMap = new Map<string, string>()
  for (const doc of museumSnapshot.docs) {
    const museum = doc.data() as Museum

    museumAliasToMuseumNameMap.set(museum.name, museum.name)
    museumNameToMuseumIdMap.set(museum.name, doc.id)
    if (!museum.aliases) continue
    for (const alias of museum.aliases) {
      museumAliasToMuseumNameMap.set(alias, museum.name)
      museumNameToMuseumIdMap.set(alias, doc.id)
    }
  }

  for (const exhibition of transformed) {
    const canonicalVenueName = museumAliasToMuseumNameMap.get(exhibition.venue)

    if (canonicalVenueName === undefined) {
      // TODO: Handle this case better
      console.error(`Venue not found for exhibition: ${exhibition.venue} - ${exhibition.title}`)
      continue
    }

    const museumId = museumNameToMuseumIdMap.get(canonicalVenueName)

    if (museumId === undefined) {
      // TODO: Handle this case better
      console.error(`Museum ID not found for venue: ${canonicalVenueName}`)
      continue
    }

    const newDocumentId = getExhibitionDocumentId(museumId, exhibition.title)

    // Check if document with the same hash already exists
    const existingExhibition = existingExhibitionsMap.get(newDocumentId)

    if (existingExhibition) {
      const startDateChanged = !areDatesEqual(existingExhibition.startDate, exhibition.startDate)
      const endDateChanged = !areDatesEqual(existingExhibition.endDate, exhibition.endDate)

      if (!startDateChanged && !endDateChanged) {
        console.log(`Skipping duplicate document with id: ${newDocumentId}`)
        continue
      }

      // Update existing document with new dates
      await exhibitionCollectionRef.doc(newDocumentId).update({
        startDate: exhibition.startDate
          ? Timestamp.fromDate(new TZDate(exhibition.startDate, 'Asia/Tokyo'))
          : '',
        endDate: exhibition.endDate
          ? Timestamp.fromDate(new TZDate(exhibition.endDate, 'Asia/Tokyo'))
          : '',
        hasDateChanged: true,
        updatedAt: Timestamp.now(),
      })
      console.log(`Updated document with id: ${newDocumentId} (dates changed)`)
    } else {
      await exhibitionCollectionRef.doc(newDocumentId).set(
        {
          title: exhibition.title,
          venue: canonicalVenueName,
          museumId: museumId,
          startDate: exhibition.startDate
            ? Timestamp.fromDate(new TZDate(exhibition.startDate, 'Asia/Tokyo'))
            : '',
          endDate: exhibition.endDate
            ? Timestamp.fromDate(new TZDate(exhibition.endDate, 'Asia/Tokyo'))
            : '',
          officialUrl: exhibition.officialUrl,
          status: 'pending',
          origin: 'scrape',
          isExcluded: false,
          hasDateChanged: false,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        },
        { merge: false },
      )
      console.log(`Added document with id: ${newDocumentId}`)
    }
  }

  return c.text(`Scrape successful. Found ${transformed.length} exhibitions.`, 201)
})

app.post('/scrape-feed', async (c) => {
  const { APIFY_ACTOR_ID, OPENAI_API_KEY } = env<{
    APIFY_ACTOR_ID: string
    OPENAI_API_KEY: string
  }>(c)

  const museumSnapshot = await db.collection('museum').get()

  const input = {
    excludeUrlGlobs: [
      {
        glob: '',
      },
    ],
    instructions: '「展覧会」情報を取得して、指定されたJSONの形式で出力して下さい。',
    linkSelector: 'a[href]',
    maxCrawlingDepth: 1,
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
                description: '展覧会のタイトル',
              },
              venue: {
                type: 'string',
                description: '会場名',
              },
              startDate: {
                type: 'string',
                description: '展覧会の開始日時',
              },
              endDate: {
                type: 'string',
                description: '展覧会の終了日時',
              },
            },
            additionalProperties: false,
          },
        },
      },
    },
    schemaDescription:
      '`title` の先頭に「特別展」「企画展」などの余計な単語を付け加えないでください。`startDate`と`endDate`は`yyyy-mm-dd`形式で出力して下さい。`venue`は美術館、博物館の名称を出力して下さい。例えば、`venue`には「本館展示室」「企画展示室」ではなく「国立西洋美術館」を出力して下さい。情報が見つからない場合は空文字列を出力して下さい。',
    startUrls: [
      {
        url: 'https://www.tokyoartbeat.com/events/regionId/3t69ZtVfJeKUQ2UM0DXnJM/orderBy/latest',
        method: 'GET',
      },
    ],
    useStructureOutput: true,
  }

  console.log('Starting Actor: ', APIFY_ACTOR_ID)
  const run = await apifyClient.actor(APIFY_ACTOR_ID).call(input, {
    timeout: 300,
  })

  const { items: response } = await apifyClient.dataset(run.defaultDatasetId).listItems()

  const transformed = apifyResponseWithoutUrlSchema.parse(response)
  console.log('Transformed data: ', transformed)

  const exhibitionCollectionRef = db.collection('exhibition')

  // Fetch existing documents to check for duplicates and date changes
  const existingExhibitionsMap = new Map<
    string,
    {
      startDate: Timestamp | string
      endDate: Timestamp | string
    }
  >()
  const existingDocumentsSnapshot = await exhibitionCollectionRef.get()
  existingDocumentsSnapshot.forEach((doc) => {
    const data = doc.data()
    existingExhibitionsMap.set(doc.id, {
      startDate: data.startDate,
      endDate: data.endDate,
    })
  })

  const museumAliasToMuseumNameMap = new Map<string, string>()
  const museumNameToMuseumIdMap = new Map<string, string>()
  for (const doc of museumSnapshot.docs) {
    const museum = doc.data() as Museum

    museumAliasToMuseumNameMap.set(museum.name, museum.name)
    museumNameToMuseumIdMap.set(museum.name, doc.id)
    if (!museum.aliases) continue
    for (const alias of museum.aliases) {
      museumAliasToMuseumNameMap.set(alias, museum.name)
      museumNameToMuseumIdMap.set(alias, doc.id)
    }
  }

  for (const exhibition of transformed) {
    const canonicalVenueName = museumAliasToMuseumNameMap.get(exhibition.venue)

    if (canonicalVenueName === undefined) {
      console.log(
        `Venue is not registered for exhibition: ${exhibition.venue} - ${exhibition.title}`,
      )
      continue
    }

    const museumId = museumNameToMuseumIdMap.get(canonicalVenueName)

    if (museumId === undefined) {
      // TODO: Handle this case better
      console.error(`Museum ID not found for venue: ${canonicalVenueName}`)
      continue
    }

    const newDocumentId = getExhibitionDocumentId(museumId, exhibition.title)

    // Check if document with the same hash already exists
    const existingExhibition = existingExhibitionsMap.get(newDocumentId)

    if (existingExhibition) {
      const startDateChanged = !areDatesEqual(existingExhibition.startDate, exhibition.startDate)
      const endDateChanged = !areDatesEqual(existingExhibition.endDate, exhibition.endDate)

      if (!startDateChanged && !endDateChanged) {
        console.log(`Skipping duplicate document with id: ${newDocumentId}`)
        continue
      }

      // Update existing document with new dates
      await exhibitionCollectionRef.doc(newDocumentId).update({
        startDate: exhibition.startDate
          ? Timestamp.fromDate(new TZDate(exhibition.startDate, 'Asia/Tokyo'))
          : '',
        endDate: exhibition.endDate
          ? Timestamp.fromDate(new TZDate(exhibition.endDate, 'Asia/Tokyo'))
          : '',
        hasDateChanged: true,
        updatedAt: Timestamp.now(),
      })
      console.log(`Updated document with id: ${newDocumentId} (dates changed)`)
    } else {
      await exhibitionCollectionRef.doc(newDocumentId).set(
        {
          title: exhibition.title,
          venue: canonicalVenueName,
          museumId: museumId,
          startDate: exhibition.startDate
            ? Timestamp.fromDate(new TZDate(exhibition.startDate, 'Asia/Tokyo'))
            : '',
          endDate: exhibition.endDate
            ? Timestamp.fromDate(new TZDate(exhibition.endDate, 'Asia/Tokyo'))
            : '',
          status: 'pending',
          origin: 'scrape-feed',
          isExcluded: false,
          hasDateChanged: false,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        },
        { merge: false },
      )
      console.log(`Added document with id: ${newDocumentId}`)
    }
  }

  return c.text(`Scrape successful. Found ${transformed.length} exhibitions.`, 201)
})

export default app
