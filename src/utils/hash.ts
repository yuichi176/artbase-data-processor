import crypto from 'crypto'

function normalize(text: string): string {
  return text
    .normalize('NFKC') // 全角 → 半角
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function getDocumentHash(title: string, venue: string): string {
  const normalizedTitle = normalize(title)
  const normalizedVenue = normalize(venue)

  return crypto.createHash('md5').update(`${normalizedTitle}_${normalizedVenue}`).digest('hex')
}
