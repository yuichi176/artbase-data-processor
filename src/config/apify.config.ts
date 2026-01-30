import type { ApifyActorInput } from '../types/exhibition.js'

const BASE_CONFIG = {
  excludeUrlGlobs: [{ glob: '' }],
  linkSelector: 'a[href]',
  maxPagesPerCrawl: 100,
  model: 'gpt-4o-mini',
  proxyConfiguration: {
    useApifyProxy: true,
    apifyProxyGroups: [],
  },
  removeElementsCssSelector: 'script, style, noscript, path, svg, xlink',
  removeLinkUrls: false,
  saveSnapshots: true,
  useStructureOutput: true,
}

const EXHIBITION_SCHEMA = {
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
}

const EXHIBITION_SCHEMA_WITHOUT_URLS = {
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
}

export function buildScrapeActorInput(
  startUrls: Array<{ url: string; method: 'GET' }>,
  openaiApiKey: string,
): ApifyActorInput {
  return {
    ...BASE_CONFIG,
    instructions:
      '開催中、開催予定の「展覧会」の情報を取得して、指定されたJSONの形式で出力して下さい。「常設展」の情報はJSONに含めないでください。',
    maxCrawlingDepth: 2,
    openaiApiKey,
    schema: EXHIBITION_SCHEMA,
    schemaDescription:
      '`title`の先頭に「特別展」「企画展」などの余計な単語を付け加えないでください。`startDate`と`endDate`は`yyyy-mm-dd`形式で出力して下さい。`officialUrl`と`imageUrl`は`https`始まりの代表画像のURLを出力して下さい。`venue`は美術館、博物館の名称を出力して下さい。例えば、`venue`には「本館展示室」「企画展示室」ではなく「国立西洋美術館」を出力して下さい。情報が見つからない場合は空文字列を出力して下さい。',
    startUrls,
  }
}

export function buildScrapeFeedActorInput(openaiApiKey: string): ApifyActorInput {
  return {
    ...BASE_CONFIG,
    instructions: '「展覧会」情報を取得して、指定されたJSONの形式で出力して下さい。',
    maxCrawlingDepth: 1,
    openaiApiKey,
    schema: EXHIBITION_SCHEMA_WITHOUT_URLS,
    schemaDescription:
      '`title` の先頭に「特別展」「企画展」などの余計な単語を付け加えないでください。`startDate`と`endDate`は`yyyy-mm-dd`形式で出力して下さい。`venue`は美術館、博物館の名称を出力して下さい。例えば、`venue`には「本館展示室」「企画展示室」ではなく「国立西洋美術館」を出力して下さい。情報が見つからない場合は空文字列を出力して下さい。',
    startUrls: [
      {
        url: 'https://www.tokyoartbeat.com/events/regionId/3t69ZtVfJeKUQ2UM0DXnJM/orderBy/latest',
        method: 'GET',
      },
    ],
  }
}
