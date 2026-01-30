import apifyClient from '../lib/apify.js'
import { ExternalServiceError } from '../errors/app-error.js'
import type { ApifyActorInput } from '../types/apify.js'

const ACTOR_TIMEOUT_SECONDS = 300

export async function runActorAndGetResults<T>(
  actorId: string,
  input: ApifyActorInput,
): Promise<T[]> {
  try {
    console.log('Starting Actor:', actorId)

    const run = await apifyClient.actor(actorId).call(input, {
      timeout: ACTOR_TIMEOUT_SECONDS,
    })

    const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems()

    return items as T[]
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    throw new ExternalServiceError(`Failed to run Apify actor: ${message}`, 'Apify')
  }
}
