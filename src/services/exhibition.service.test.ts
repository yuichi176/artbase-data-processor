import { describe, it, expect, vi, beforeEach } from 'vitest'
import { normalizeVenue, getMuseumId, processScrapeResults } from './exhibition.service.js'
import type { MuseumMaps } from '../types/museum.js'
import type { ScrapedExhibition } from '../schemas/exhibition.schema.js'
import { NotFoundError } from '../errors/app-error.js'

/**
 * Mock type for Firestore transaction object
 * Used to avoid complex Firestore Transaction type in tests
 */
type MockTransaction = {
  get: ReturnType<typeof vi.fn>
  set: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
}

// Mock dependencies
vi.mock('../lib/firestore.js', () => ({
  default: {
    collection: vi.fn(),
    runTransaction: vi.fn(),
  },
}))

vi.mock('../utils/hash.js', () => ({
  getExhibitionDocumentId: vi.fn((museumId: string, title: string) => `${museumId}_${title}`),
}))

vi.mock('../utils/date.js', () => ({
  areDatesEqual: vi.fn((date1, date2) => {
    if (date1 === undefined && date2 === undefined) return true
    if (date1 === undefined || date2 === undefined) return false
    return date1 === date2
  }),
}))

describe('exhibition.service', () => {
  describe('normalizeVenue', () => {
    it('should return canonical name for valid venue', () => {
      const museumMaps = {
        aliasToName: new Map([
          ['東京国立博物館', '東京国立博物館'],
          ['東博', '東京国立博物館'],
        ]),
        nameToId: new Map([['東京国立博物館', 'museum1']]),
      } satisfies MuseumMaps

      const result = normalizeVenue('東博', museumMaps)
      expect(result).toBe('東京国立博物館')
    })

    it('should return canonical name for canonical name input', () => {
      const museumMaps = {
        aliasToName: new Map([['東京国立博物館', '東京国立博物館']]),
        nameToId: new Map([['東京国立博物館', 'museum1']]),
      } satisfies MuseumMaps

      const result = normalizeVenue('東京国立博物館', museumMaps)
      expect(result).toBe('東京国立博物館')
    })

    it('should return null for unknown venue', () => {
      const museumMaps = {
        aliasToName: new Map([['東京国立博物館', '東京国立博物館']]),
        nameToId: new Map([['東京国立博物館', 'museum1']]),
      } satisfies MuseumMaps

      const result = normalizeVenue('不明な美術館', museumMaps)
      expect(result).toBeNull()
    })
  })

  describe('getMuseumId', () => {
    it('should return museum ID for valid venue name', () => {
      const museumMaps = {
        aliasToName: new Map([['東京国立博物館', '東京国立博物館']]),
        nameToId: new Map([['東京国立博物館', 'museum1']]),
      } satisfies MuseumMaps

      const result = getMuseumId('東京国立博物館', museumMaps)
      expect(result).toBe('museum1')
    })

    it('should throw NotFoundError for unknown venue name', () => {
      const museumMaps = {
        aliasToName: new Map([['東京国立博物館', '東京国立博物館']]),
        nameToId: new Map([['東京国立博物館', 'museum1']]),
      } satisfies MuseumMaps

      expect(() => getMuseumId('不明な美術館', museumMaps)).toThrow(NotFoundError)
      expect(() => getMuseumId('不明な美術館', museumMaps)).toThrow(
        'Museum ID not found for venue: 不明な美術館',
      )
    })
  })

  describe('processScrapeResults', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('should create new exhibitions successfully', async () => {
      const exhibitions = [
        {
          title: '特別展：日本の美',
          venue: '東京国立博物館',
          startDate: '2024-01-01',
          endDate: '2024-03-31',
        },
      ] satisfies ScrapedExhibition[]

      const museumMaps = {
        aliasToName: new Map([['東京国立博物館', '東京国立博物館']]),
        nameToId: new Map([['東京国立博物館', 'museum1']]),
      } satisfies MuseumMaps

      const mockTransaction: MockTransaction = {
        get: vi.fn().mockImplementation((ref) => {
          if (Array.isArray(ref)) {
            return Promise.resolve(ref.map(() => ({ exists: false })))
          }
          return Promise.resolve({ exists: false })
        }),
        set: vi.fn(),
        update: vi.fn(),
      }

      const db = await import('../lib/firestore.js')
      const mockCollection = vi.fn().mockReturnValue({
        doc: vi.fn().mockReturnValue({
          id: 'mock-doc-id',
        }),
      })

      vi.mocked(db.default.collection).mockImplementation(mockCollection as never)
      // Firestore's Transaction type is complex, so we use our simplified MockTransaction
      vi.mocked(db.default.runTransaction).mockImplementation(async (callback) => {
        return await callback(mockTransaction as never)
      })

      const result = await processScrapeResults(exhibitions, museumMaps, 'scrape')

      expect(result.created).toBe(1)
      expect(result.updated).toBe(0)
      expect(result.skipped).toBe(0)
      expect(result.errors).toBe(0)
    })

    it('should skip exhibitions with unknown venues', async () => {
      const exhibitions = [
        {
          title: '特別展',
          venue: '不明な美術館',
          startDate: '2024-01-01',
          endDate: '2024-03-31',
        },
      ] satisfies ScrapedExhibition[]

      const museumMaps = {
        aliasToName: new Map([['東京国立博物館', '東京国立博物館']]),
        nameToId: new Map([['東京国立博物館', 'museum1']]),
      } satisfies MuseumMaps

      const mockTransaction: MockTransaction = {
        get: vi.fn(),
        set: vi.fn(),
        update: vi.fn(),
      }

      const db = await import('../lib/firestore.js')
      // Firestore's Transaction type is complex, so we use our simplified MockTransaction
      vi.mocked(db.default.runTransaction).mockImplementation(async (callback) => {
        return await callback(mockTransaction as never)
      })

      const result = await processScrapeResults(exhibitions, museumMaps, 'scrape')

      expect(result.created).toBe(0)
      expect(result.updated).toBe(0)
      expect(result.skipped).toBe(0)
      expect(result.errors).toBe(1)
    })

    it('should update exhibitions when dates change', async () => {
      const exhibitions = [
        {
          title: '特別展：日本の美',
          venue: '東京国立博物館',
          startDate: '2024-02-01',
          endDate: '2024-04-30',
        },
      ] satisfies ScrapedExhibition[]

      const museumMaps = {
        aliasToName: new Map([['東京国立博物館', '東京国立博物館']]),
        nameToId: new Map([['東京国立博物館', 'museum1']]),
      } satisfies MuseumMaps

      const mockExistingData = {
        startDate: '2024-01-01',
        endDate: '2024-03-31',
      }

      const mockTransaction: MockTransaction = {
        get: vi.fn().mockImplementation((ref) => {
          if (Array.isArray(ref)) {
            return Promise.resolve(
              ref.map(() => ({
                exists: true,
                data: () => mockExistingData,
              })),
            )
          }
          return Promise.resolve({
            exists: true,
            data: () => mockExistingData,
          })
        }),
        set: vi.fn(),
        update: vi.fn(),
      }

      const db = await import('../lib/firestore.js')
      const mockCollection = vi.fn().mockReturnValue({
        doc: vi.fn().mockReturnValue({
          id: 'mock-doc-id',
        }),
      })

      vi.mocked(db.default.collection).mockImplementation(mockCollection as never)
      vi.mocked(db.default.runTransaction).mockImplementation(async (callback) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return await callback(mockTransaction as any)
      })

      // Mock areDatesEqual to return false (dates changed)
      const dateUtils = await import('../utils/date.js')
      vi.mocked(dateUtils.areDatesEqual).mockReturnValue(false)

      const result = await processScrapeResults(exhibitions, museumMaps, 'scrape')

      expect(result.created).toBe(0)
      expect(result.updated).toBe(1)
      expect(result.skipped).toBe(0)
      expect(result.errors).toBe(0)
      expect(mockTransaction.update).toHaveBeenCalled()
    })

    it('should skip exhibitions when dates are unchanged', async () => {
      const exhibitions = [
        {
          title: '特別展：日本の美',
          venue: '東京国立博物館',
          startDate: '2024-01-01',
          endDate: '2024-03-31',
        },
      ] satisfies ScrapedExhibition[]

      const museumMaps = {
        aliasToName: new Map([['東京国立博物館', '東京国立博物館']]),
        nameToId: new Map([['東京国立博物館', 'museum1']]),
      } satisfies MuseumMaps

      const mockExistingData = {
        startDate: '2024-01-01',
        endDate: '2024-03-31',
      }

      const mockTransaction: MockTransaction = {
        get: vi.fn().mockImplementation((ref) => {
          if (Array.isArray(ref)) {
            return Promise.resolve(
              ref.map(() => ({
                exists: true,
                data: () => mockExistingData,
              })),
            )
          }
          return Promise.resolve({
            exists: true,
            data: () => mockExistingData,
          })
        }),
        set: vi.fn(),
        update: vi.fn(),
      }

      const db = await import('../lib/firestore.js')
      const mockCollection = vi.fn().mockReturnValue({
        doc: vi.fn().mockReturnValue({
          id: 'mock-doc-id',
        }),
      })

      vi.mocked(db.default.collection).mockImplementation(mockCollection as never)
      vi.mocked(db.default.runTransaction).mockImplementation(async (callback) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return await callback(mockTransaction as any)
      })

      // Mock areDatesEqual to return true (dates unchanged)
      const dateUtils = await import('../utils/date.js')
      vi.mocked(dateUtils.areDatesEqual).mockReturnValue(true)

      const result = await processScrapeResults(exhibitions, museumMaps, 'scrape')

      expect(result.created).toBe(0)
      expect(result.updated).toBe(0)
      expect(result.skipped).toBe(1)
      expect(result.errors).toBe(0)
    })

    it('should process multiple exhibitions in batches', async () => {
      const exhibitions: ScrapedExhibition[] = Array.from({ length: 150 }, (_, i) => ({
        title: `展覧会${i + 1}`,
        venue: '東京国立博物館',
        startDate: '2024-01-01',
        endDate: '2024-03-31',
      }))

      const museumMaps = {
        aliasToName: new Map([['東京国立博物館', '東京国立博物館']]),
        nameToId: new Map([['東京国立博物館', 'museum1']]),
      } satisfies MuseumMaps

      const mockTransaction: MockTransaction = {
        get: vi.fn().mockImplementation((ref) => {
          if (Array.isArray(ref)) {
            return Promise.resolve(ref.map(() => ({ exists: false })))
          }
          return Promise.resolve({ exists: false })
        }),
        set: vi.fn(),
        update: vi.fn(),
      }

      const db = await import('../lib/firestore.js')
      const mockCollection = vi.fn().mockReturnValue({
        doc: vi.fn().mockReturnValue({
          id: 'mock-doc-id',
        }),
      })

      vi.mocked(db.default.collection).mockImplementation(mockCollection as never)
      // Firestore's Transaction type is complex, so we use our simplified MockTransaction
      vi.mocked(db.default.runTransaction).mockImplementation(async (callback) => {
        return await callback(mockTransaction as never)
      })

      const result = await processScrapeResults(exhibitions, museumMaps, 'scrape')

      expect(result.created).toBe(150)
      expect(result.updated).toBe(0)
      expect(result.skipped).toBe(0)
      expect(result.errors).toBe(0)
      // Verify runTransaction was called twice (150 exhibitions / 100 batch size = 2 batches)
      expect(db.default.runTransaction).toHaveBeenCalledTimes(2)
    })

    it('should handle transaction failures', async () => {
      const exhibitions = [
        {
          title: '特別展',
          venue: '東京国立博物館',
          startDate: '2024-01-01',
          endDate: '2024-03-31',
        },
      ] satisfies ScrapedExhibition[]

      const museumMaps = {
        aliasToName: new Map([['東京国立博物館', '東京国立博物館']]),
        nameToId: new Map([['東京国立博物館', 'museum1']]),
      } satisfies MuseumMaps

      const db = await import('../lib/firestore.js')
      const mockCollection = vi.fn().mockReturnValue({
        doc: vi.fn().mockReturnValue({
          id: 'mock-doc-id',
        }),
      })

      vi.mocked(db.default.collection).mockImplementation(mockCollection as never)
      vi.mocked(db.default.runTransaction).mockRejectedValue(new Error('Transaction failed'))

      const result = await processScrapeResults(exhibitions, museumMaps, 'scrape')

      expect(result.created).toBe(0)
      expect(result.updated).toBe(0)
      expect(result.skipped).toBe(0)
      expect(result.errors).toBe(1)
    })
  })
})
