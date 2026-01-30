import db from '../lib/firestore.js'
import type { Museum } from '../schemas/museum.schema.js'
import type { MuseumDocument, MuseumMaps } from '../types/museum.js'

export async function fetchEnabledMuseumsWithUrls(): Promise<{
  museums: Museum[]
  startUrls: Array<{ url: string; method: 'GET' }>
}> {
  const snapshot = await db.collection('museum').where('scrapeEnabled', '==', false).get()

  const museums: Museum[] = []
  const startUrls: Array<{ url: string; method: 'GET' }> = []

  snapshot.docs.forEach((doc) => {
    const museum = doc.data() as MuseumDocument
    museums.push({
      ...museum,
      id: doc.id,
    })
    startUrls.push({
      url: museum.scrapeUrl,
      method: 'GET',
    })
  })

  return { museums, startUrls }
}

export async function fetchAllMuseums(): Promise<Museum[]> {
  const snapshot = await db.collection('museum').get()
  return snapshot.docs.map((doc) => {
    const museum = doc.data() as MuseumDocument
    return {
      ...museum,
      id: doc.id,
    }
  })
}

export function buildMuseumMaps(museums: Museum[]): MuseumMaps {
  const aliasToName = new Map<string, string>()
  const nameToId = new Map<string, string>()

  for (const museum of museums) {
    // Map museum name to itself
    aliasToName.set(museum.name, museum.name)
    nameToId.set(museum.name, museum.id)

    // Map aliases to canonical name
    if (museum.aliases) {
      for (const alias of museum.aliases) {
        aliasToName.set(alias, museum.name)
        nameToId.set(alias, museum.id)
      }
    }
  }

  return { aliasToName, nameToId }
}
