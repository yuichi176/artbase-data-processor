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
function normalize(text: string): string {
  return text.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim()
}

/**
 * Generates a deterministic document ID for an exhibition document.
 */
export function getExhibitionDocumentId(museumId: string, title: string): string {
  const hashedTitle = crypto.createHash('md5').update(normalize(title)).digest('base64url')
  return `${museumId}_${hashedTitle}`
}
