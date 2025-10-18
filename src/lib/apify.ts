import { ApifyClient } from 'apify-client'

const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN

if (!APIFY_API_TOKEN) {
  throw new Error('Missing required environment variable: APIFY_API_TOKEN')
}

const apifyClient = new ApifyClient({ token: APIFY_API_TOKEN })

export default apifyClient
