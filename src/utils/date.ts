import { TZDate } from '@date-fns/tz'
import { Timestamp } from '@google-cloud/firestore'

/**
 * Compare Firestore Timestamps or empty strings representing dates
 */
export function areDatesEqual(
  existing: Timestamp | string,
  incoming: string | undefined | null,
): boolean {
  const incomingDate = incoming ? Timestamp.fromDate(new TZDate(incoming, 'Asia/Tokyo')) : ''

  // Both empty strings
  if (typeof existing === 'string' && typeof incomingDate === 'string') {
    return true
  }

  // One empty, one not
  if (typeof existing === 'string' || typeof incomingDate === 'string') {
    return false
  }

  // Both Timestamps - use Firestore's isEqual()
  return existing.isEqual(incomingDate)
}
