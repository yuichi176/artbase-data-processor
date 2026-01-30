import db from '../lib/firestore.js'
import { Timestamp } from '@google-cloud/firestore'
import { TZDate } from '@date-fns/tz'
import { getExhibitionDocumentId } from '../utils/hash.js'
import { areDatesEqual } from '../utils/date.js'
import type { MuseumMaps, ProcessExhibitionResult } from '../types/exhibition.js'
import { NotFoundError } from '../errors/app-error.js'

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
  origin: 'scrape' | 'scrape-feed'
}

export async function processExhibition({
  exhibition,
  museumMaps,
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
  const docRef = db.collection('exhibition').doc(documentId)

  // Use transaction for atomic check-and-write to prevent TOCTOU race conditions
  return await db.runTransaction(async (transaction) => {
    // Read phase: Get existing document
    const existingDoc = await transaction.get(docRef)

    if (existingDoc.exists) {
      // Check for date changes
      const data = existingDoc.data()
      if (!data) {
        throw new Error(`Document ${documentId} exists but has no data`)
      }

      const startDateChanged = !areDatesEqual(data.startDate, exhibition.startDate)
      const endDateChanged = !areDatesEqual(data.endDate, exhibition.endDate)

      if (!startDateChanged && !endDateChanged) {
        console.log(`Skipping duplicate document with id: ${documentId}`)
        return {
          documentId,
          action: 'skipped' as const,
          reason: 'No date changes',
        }
      }

      // Write phase: Update existing document with new dates
      transaction.update(docRef, {
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
        action: 'updated' as const,
        reason: 'Dates changed',
      }
    }

    // Write phase: Create new document
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

    transaction.set(docRef, newExhibition)

    console.log(`Added document with id: ${documentId}`)
    return {
      documentId,
      action: 'created' as const,
    }
  })
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
