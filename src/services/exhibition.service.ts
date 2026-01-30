import db from '../lib/firestore.js'
import { Timestamp } from '@google-cloud/firestore'
import { TZDate } from '@date-fns/tz'
import { getExhibitionDocumentId } from '../utils/hash.js'
import { areDatesEqual } from '../utils/date.js'
import type {
  ExistingExhibition,
  MuseumMaps,
  ProcessExhibitionResult,
} from '../types/exhibition.js'
import { NotFoundError } from '../errors/app-error.js'

export async function fetchExistingExhibitions(): Promise<Map<string, ExistingExhibition>> {
  const exhibitionCollectionRef = db.collection('exhibition')
  const snapshot = await exhibitionCollectionRef.get()

  const existingExhibitionsMap = new Map<string, ExistingExhibition>()

  snapshot.forEach((doc) => {
    const data = doc.data()
    existingExhibitionsMap.set(doc.id, {
      startDate: data.startDate,
      endDate: data.endDate,
    })
  })

  return existingExhibitionsMap
}

export function normalizeVenue(venue: string, museumMaps: MuseumMaps): string | null {
  return museumMaps.aliasToName.get(venue) ?? null
}

export function getMuseumId(venueName: string, museumMaps: MuseumMaps): string {
  const museumId = museumMaps.nameToId.get(venueName)
  if (!museumId) {
    throw new NotFoundError(`Museum ID not found for venue: ${venueName}`)
  }
  return museumId
}

interface ProcessExhibitionParams {
  exhibition: {
    title: string
    venue: string
    startDate?: string | null | undefined
    endDate?: string | null | undefined
    officialUrl?: string | null | undefined
    imageUrl?: string | null | undefined
  }
  museumMaps: MuseumMaps
  existingExhibitionsMap: Map<string, ExistingExhibition>
  origin: 'scrape' | 'scrape-feed'
}

export async function processExhibition({
  exhibition,
  museumMaps,
  existingExhibitionsMap,
  origin,
}: ProcessExhibitionParams): Promise<ProcessExhibitionResult> {
  const canonicalVenueName = normalizeVenue(exhibition.venue, museumMaps)

  if (!canonicalVenueName) {
    throw new NotFoundError(
      `Venue not found for exhibition: ${exhibition.venue} - ${exhibition.title}`,
    )
  }

  const museumId = getMuseumId(canonicalVenueName, museumMaps)
  const documentId = getExhibitionDocumentId(museumId, exhibition.title)
  const existingExhibition = existingExhibitionsMap.get(documentId)

  const exhibitionCollectionRef = db.collection('exhibition')

  if (existingExhibition) {
    const startDateChanged = !areDatesEqual(existingExhibition.startDate, exhibition.startDate)
    const endDateChanged = !areDatesEqual(existingExhibition.endDate, exhibition.endDate)

    if (!startDateChanged && !endDateChanged) {
      console.log(`Skipping duplicate document with id: ${documentId}`)
      return {
        documentId,
        action: 'skipped',
        reason: 'No date changes',
      }
    }

    // Update existing document with new dates
    await exhibitionCollectionRef.doc(documentId).update({
      startDate: exhibition.startDate
        ? Timestamp.fromDate(new TZDate(exhibition.startDate, 'Asia/Tokyo'))
        : '',
      endDate: exhibition.endDate
        ? Timestamp.fromDate(new TZDate(exhibition.endDate, 'Asia/Tokyo'))
        : '',
      hasDateChanged: true,
      updatedAt: Timestamp.now(),
    })

    console.log(`Updated document with id: ${documentId} (dates changed)`)
    return {
      documentId,
      action: 'updated',
      reason: 'Dates changed',
    }
  }

  // Create new document
  const newExhibition: Record<string, unknown> = {
    title: exhibition.title,
    venue: canonicalVenueName,
    museumId,
    startDate: exhibition.startDate
      ? Timestamp.fromDate(new TZDate(exhibition.startDate, 'Asia/Tokyo'))
      : '',
    endDate: exhibition.endDate
      ? Timestamp.fromDate(new TZDate(exhibition.endDate, 'Asia/Tokyo'))
      : '',
    status: 'pending',
    origin,
    isExcluded: false,
    hasDateChanged: false,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  }

  // Add optional fields for scrape origin
  if (origin === 'scrape' && exhibition.officialUrl) {
    newExhibition.officialUrl = exhibition.officialUrl
  }

  await exhibitionCollectionRef.doc(documentId).set(newExhibition, { merge: false })

  console.log(`Added document with id: ${documentId}`)
  return {
    documentId,
    action: 'created',
  }
}

export async function processScrapeResults(
  exhibitions: Array<{
    title: string
    venue: string
    startDate?: string | null | undefined
    endDate?: string | null | undefined
    officialUrl?: string | null | undefined
    imageUrl?: string | null | undefined
  }>,
  museumMaps: MuseumMaps,
  origin: 'scrape' | 'scrape-feed',
): Promise<{
  created: number
  updated: number
  skipped: number
  errors: number
}> {
  const existingExhibitionsMap = await fetchExistingExhibitions()

  const results = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
  }

  for (const exhibition of exhibitions) {
    try {
      const result = await processExhibition({
        exhibition,
        museumMaps,
        existingExhibitionsMap,
        origin,
      })

      if (result.action === 'created') {
        results.created++
      } else if (result.action === 'updated') {
        results.updated++
      } else if (result.action === 'skipped') {
        results.skipped++
      }
    } catch (error) {
      if (error instanceof NotFoundError) {
        console.error(error.message)
      } else {
        console.error('Error processing exhibition:', error)
      }
      results.errors++
    }
  }

  return results
}
