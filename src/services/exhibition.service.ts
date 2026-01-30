import db from '../lib/firestore.js'
import { Timestamp } from '@google-cloud/firestore'
import { TZDate } from '@date-fns/tz'
import { getExhibitionDocumentId } from '../utils/hash.js'
import { areDatesEqual } from '../utils/date.js'
import type { NewExhibitionDocument } from '../types/exhibition.js'
import type { MuseumMaps } from '../types/museum.js'
import { NotFoundError } from '../errors/app-error.js'
import type { ScrapedExhibition } from '../schemas/exhibition.schema.js'

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

/**
 * Process a batch of exhibitions in a single transaction
 * This reduces the number of transactions and document reads
 */
async function processExhibitionBatch(
  exhibitions: Array<ScrapedExhibition>,
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

  // Prepare document references and validate all exhibitions first
  const exhibitionData: Array<{
    exhibition: ScrapedExhibition
    documentId: string
    docRef: FirebaseFirestore.DocumentReference
    museumId: string
    canonicalVenueName: string
  }> = []

  for (const exhibition of exhibitions) {
    try {
      const canonicalVenueName = normalizeVenue(exhibition.venue, museumMaps)

      if (!canonicalVenueName) {
        console.error(`Venue not found for exhibition: ${exhibition.venue} - ${exhibition.title}`)
        results.errors++
        continue
      }

      const museumId = getMuseumId(canonicalVenueName, museumMaps)
      const documentId = getExhibitionDocumentId(museumId, exhibition.title)
      const docRef = db.collection('exhibition').doc(documentId)

      exhibitionData.push({
        exhibition,
        documentId,
        docRef,
        museumId,
        canonicalVenueName,
      })
    } catch (error) {
      if (error instanceof NotFoundError) {
        console.error(error.message)
      } else {
        console.error('Error preparing exhibition:', error)
      }
      results.errors++
    }
  }

  if (exhibitionData.length === 0) {
    return results
  }

  // Process all exhibitions in a single transaction
  try {
    await db.runTransaction(async (transaction) => {
      // Read phase: Get all existing documents at once
      const existingDocs = await Promise.all(
        exhibitionData.map((data) => transaction.get(data.docRef)),
      )

      // Write phase: Process each exhibition based on existing data
      for (let i = 0; i < exhibitionData.length; i++) {
        const { exhibition, documentId, docRef, museumId, canonicalVenueName } = exhibitionData[i]
        const existingDoc = existingDocs[i]

        if (existingDoc.exists) {
          // Check for date changes
          const data = existingDoc.data()
          if (!data) {
            console.error(`Document ${documentId} exists but has no data`)
            results.errors++
            continue
          }

          const startDateChanged = !areDatesEqual(data.startDate, exhibition.startDate)
          const endDateChanged = !areDatesEqual(data.endDate, exhibition.endDate)

          if (!startDateChanged && !endDateChanged) {
            console.log(`Skipping duplicate document with id: ${documentId}`)
            results.skipped++
            continue
          }

          // Update existing document with new dates
          transaction.update(docRef, {
            ...(exhibition.startDate && {
              startDate: Timestamp.fromDate(new TZDate(exhibition.startDate, 'Asia/Tokyo')),
            }),
            ...(exhibition.endDate && {
              endDate: Timestamp.fromDate(new TZDate(exhibition.endDate, 'Asia/Tokyo')),
            }),
            hasDateChanged: true,
            updatedAt: Timestamp.now(),
          })

          console.log(`Updated document with id: ${documentId} (dates changed)`)
          results.updated++
        } else {
          // Create new document
          const newExhibition = {
            title: exhibition.title,
            venue: canonicalVenueName,
            museumId,
            ...(exhibition.startDate && {
              startDate: Timestamp.fromDate(new TZDate(exhibition.startDate, 'Asia/Tokyo')),
            }),
            ...(exhibition.endDate && {
              endDate: Timestamp.fromDate(new TZDate(exhibition.endDate, 'Asia/Tokyo')),
            }),
            status: 'pending',
            origin,
            isExcluded: false,
            hasDateChanged: false,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
            ...(origin === 'scrape' &&
              exhibition.officialUrl && { officialUrl: exhibition.officialUrl }),
          } satisfies NewExhibitionDocument

          transaction.set(docRef, newExhibition)

          console.log(`Added document with id: ${documentId}`)
          results.created++
        }
      }
    })
  } catch (error) {
    console.error('Transaction failed:', error)
    // If transaction fails, mark all as errors
    results.errors += exhibitionData.length
    results.created = 0
    results.updated = 0
    results.skipped = 0
  }

  return results
}

export async function processScrapeResults(
  exhibitions: Array<ScrapedExhibition>,
  museumMaps: MuseumMaps,
  origin: 'scrape' | 'scrape-feed',
): Promise<{
  created: number
  updated: number
  skipped: number
  errors: number
}> {
  // Firestore transaction limit is 500 documents (read + write operations combined)
  // Using 100 to allow safety margin for retries and avoid hitting limits
  const BATCH_SIZE = 100

  const totalResults = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
  }

  // Process exhibitions in batches
  for (let i = 0; i < exhibitions.length; i += BATCH_SIZE) {
    const batch = exhibitions.slice(i, i + BATCH_SIZE)
    console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} exhibitions)`)

    const batchResults = await processExhibitionBatch(batch, museumMaps, origin)

    totalResults.created += batchResults.created
    totalResults.updated += batchResults.updated
    totalResults.skipped += batchResults.skipped
    totalResults.errors += batchResults.errors
  }

  return totalResults
}
