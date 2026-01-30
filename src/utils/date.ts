import { TZDate } from '@date-fns/tz'
import { Timestamp } from '@google-cloud/firestore'

/**
 * Compare Firestore Timestamps or undefined/null values representing missing dates
 *
 * @param existing - The existing date value from Firestore (Timestamp or undefined)
 * @param incoming - The incoming date value from scraping (string, null, or undefined)
 * @returns true if dates are equal, false otherwise
 */
export function areDatesEqual(
  existing: Timestamp | undefined,
  incoming: string | undefined | null,
): boolean {
  // Convert incoming string to Timestamp if present
  const incomingDate = incoming ? Timestamp.fromDate(new TZDate(incoming, 'Asia/Tokyo')) : undefined

  // Both undefined/null
  if (existing === undefined && incomingDate === undefined) {
    return true
  }

  // One is undefined, the other is not
  if (existing === undefined || incomingDate === undefined) {
    return false
  }

  // Both are Timestamps - use Firestore's isEqual()
  return existing.isEqual(incomingDate)
}
