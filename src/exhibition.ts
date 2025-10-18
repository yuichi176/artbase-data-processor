import { Hono } from 'hono'
import { env } from 'hono/adapter'
import { apifyResponseSchema } from './schema.js'
import apifyClient from './lib/apify.js'

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
      '開催中の「企画展」、「特別展」の情報を取得して、指定されたJSONの形式で出力して下さい。',
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
                description: '企画展の開始日時（ISO 8601形式）',
              },
              endDate: {
                type: 'string',
                description: '企画展の終了日時（ISO 8601形式）',
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

  return c.json(transformed, 200)
})

export default app
