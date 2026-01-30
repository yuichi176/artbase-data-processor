/**
 * Apify actor input configuration
 */
export interface ApifyActorInput {
  excludeUrlGlobs: Array<{ glob: string }>
  instructions: string
  linkSelector: string
  maxCrawlingDepth: number
  maxPagesPerCrawl: number
  model: string
  openaiApiKey: string
  proxyConfiguration: {
    useApifyProxy: boolean
    apifyProxyGroups: string[]
  }
  removeElementsCssSelector: string
  removeLinkUrls: boolean
  saveSnapshots: boolean
  schema: object
  schemaDescription: string
  startUrls: Array<{ url: string; method: 'GET' }>
  useStructureOutput: boolean
}
