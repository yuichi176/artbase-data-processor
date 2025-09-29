import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { ApifyClient } from 'apify-client'
import { env } from 'hono/adapter'

const app = new Hono()

app.get('/health', (c) => {
  return c.json(
    {
      status: 'ok',
    },
    200,
  )
})

app.post('/scrape-exhibition-data', async (c) => {
  const { APIFY_API_TOKEN, APIFY_ACTOR_ID, OPENAI_API_KEY } = env<{
    APIFY_API_TOKEN: string
    APIFY_ACTOR_ID: string
    OPENAI_API_KEY: string
  }>(c)

  const apifyClient = new ApifyClient({ token: APIFY_API_TOKEN })
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
              description: {
                type: 'string',
                description: '企画展の概要や説明文',
              },
              venue: {
                type: 'object',
                description: '美術館に関する情報',
                properties: {
                  name: {
                    type: 'string',
                    description: '美術館名',
                  },
                  address: {
                    type: 'string',
                    description: '美術館の住所',
                  },
                  prefecture: {
                    type: 'string',
                    description: '都道府県名',
                  },
                },
              },
              startDate: {
                type: 'string',
                description: '企画展の開始日時（ISO 8601形式）',
              },
              endDate: {
                type: 'string',
                description: '企画展の終了日時（ISO 8601形式）',
              },
              imageUrl: {
                type: 'string',
                description: '企画展の代表画像URL',
              },
              officialUrl: {
                type: 'string',
                description: '企画展のURL',
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

  console.log('Results from dataset')
  const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems()
  items.forEach((item) => {
    console.dir(item)
  })
})

const port = process.env.PORT !== undefined ? parseInt(process.env.PORT) : 8080
serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`)
  },
)
