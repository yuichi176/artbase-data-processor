import crypto from 'crypto'

/**
 * Normalizes a text string to reduce variations caused by formatting differences.
 *
 * This function is intended to make scraped strings comparable by:
 * - Converting full-width characters to half-width characters using Unicode NFKC normalization
 * - Converting all characters to lowercase
 * - Collapsing multiple whitespace characters into a single space
 * - Trimming leading and trailing whitespace
 */
export function normalize(text: string): string {
  return text.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim()
}

/**
 * Generates a deterministic hash key for an exhibition document.
 * The hash is used as a Firestore document ID to prevent duplicate records.
 *
 * @param title - The exhibition title
 * @param venue - The canonical venue name
 * @returns An MD5 hash string that can be used as a unique document identifier
 */
export function getDocumentHash(title: string, venue: string): string {
  const normalizedTitle = normalize(title)
  const normalizedVenue = normalize(venue)

  return crypto.createHash('md5').update(`${normalizedTitle}_${normalizedVenue}`).digest('hex')
}
