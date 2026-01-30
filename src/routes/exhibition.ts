import { Hono } from 'hono'
import { env } from 'hono/adapter'
import { apifyResponseSchema, apifyResponseWithoutUrlSchema } from '../schema.js'
import { buildScrapeActorInput, buildScrapeFeedActorInput } from '../config/apify.config.js'
import { runActorAndGetResults } from '../services/apify.service.js'
import {
  fetchEnabledMuseumsWithUrls,
  fetchAllMuseums,
  buildMuseumMaps,
} from '../services/museum.service.js'
import { processScrapeResults } from '../services/exhibition.service.js'
import type { AppEnv } from '../types/env.js'
import { ConfigurationError } from '../errors/app-error.js'

const app = new Hono()

app.post('/scrape', async (c) => {
  const { APIFY_ACTOR_ID, OPENAI_API_KEY } = env<AppEnv>(c)

  if (!APIFY_ACTOR_ID || !OPENAI_API_KEY) {
    throw new ConfigurationError(
      'Missing required environment variables: APIFY_ACTOR_ID or OPENAI_API_KEY',
    )
  }

  // Fetch museums and build start URLs
  const { museums, startUrls } = await fetchEnabledMuseumsWithUrls()

  // Build Apify actor input
  const input = buildScrapeActorInput(startUrls, OPENAI_API_KEY)

  // Run Apify actor and get results
  const rawResults = await runActorAndGetResults(APIFY_ACTOR_ID, input)
  const exhibitions = apifyResponseSchema.parse(rawResults)

  // Build museum maps for venue normalization
  const museumMaps = buildMuseumMaps(museums)

  // Process exhibitions and save to Firestore
  const results = await processScrapeResults(exhibitions, museumMaps, 'scrape')

  return c.json(
    {
      success: true,
      message: `Scrape successful. Found ${exhibitions.length} exhibitions.`,
      stats: {
        total: exhibitions.length,
        created: results.created,
        updated: results.updated,
        skipped: results.skipped,
        errors: results.errors,
      },
    },
    201,
  )
})

app.post('/scrape-feed', async (c) => {
  const { APIFY_ACTOR_ID, OPENAI_API_KEY } = env<AppEnv>(c)

  if (!APIFY_ACTOR_ID || !OPENAI_API_KEY) {
    throw new ConfigurationError(
      'Missing required environment variables: APIFY_ACTOR_ID or OPENAI_API_KEY',
    )
  }

  // Fetch all museums for venue mapping
  const museums = await fetchAllMuseums()

  // Build Apify actor input
  const input = buildScrapeFeedActorInput(OPENAI_API_KEY)

  // Run Apify actor and get results
  const rawResults = await runActorAndGetResults(APIFY_ACTOR_ID, input)
  const exhibitions = apifyResponseWithoutUrlSchema.parse(rawResults)

  console.log('Transformed data:', exhibitions)

  // Build museum maps for venue normalization
  const museumMaps = buildMuseumMaps(museums)

  // Process exhibitions and save to Firestore
  const results = await processScrapeResults(exhibitions, museumMaps, 'scrape-feed')

  return c.json(
    {
      success: true,
      message: `Scrape successful. Found ${exhibitions.length} exhibitions.`,
      stats: {
        total: exhibitions.length,
        created: results.created,
        updated: results.updated,
        skipped: results.skipped,
        errors: results.errors,
      },
    },
    201,
  )
})

export default app
