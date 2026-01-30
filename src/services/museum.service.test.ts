import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchEnabledMuseumsWithUrls, fetchAllMuseums, buildMuseumMaps } from './museum.service.js'
import type { Museum } from '../schemas/museum.schema.js'
import type { MuseumDocument } from '../types/museum.js'

// Mock Firestore
vi.mock('../lib/firestore.js', () => ({
  default: {
    collection: vi.fn(),
  },
}))

describe('museum.service', () => {
  describe('buildMuseumMaps', () => {
    it('should build correct maps for museums with aliases', () => {
      const museums = [
        {
          id: 'museum1',
          name: '東京国立博物館',
          address: '東京都台東区上野公園13-9',
          access: 'JR上野駅から徒歩10分',
          openingInformation: '9:30-17:00',
          officialUrl: 'https://www.tnm.jp/',
          scrapeUrl: 'https://example.com',
          scrapeEnabled: true,
          venueType: '博物館',
          area: '上野',
          aliases: ['東博', 'トーハク'],
        },
        {
          id: 'museum2',
          name: '国立西洋美術館',
          address: '東京都台東区上野公園7-7',
          access: 'JR上野駅から徒歩1分',
          openingInformation: '9:30-17:30',
          officialUrl: 'https://www.nmwa.go.jp/',
          scrapeUrl: 'https://example2.com',
          scrapeEnabled: true,
          venueType: '美術館',
          area: '上野',
          aliases: ['西洋美術館'],
        },
      ] satisfies Museum[]

      const maps = buildMuseumMaps(museums)

      // Check aliasToName map
      expect(maps.aliasToName.get('東京国立博物館')).toBe('東京国立博物館')
      expect(maps.aliasToName.get('東博')).toBe('東京国立博物館')
      expect(maps.aliasToName.get('トーハク')).toBe('東京国立博物館')
      expect(maps.aliasToName.get('国立西洋美術館')).toBe('国立西洋美術館')
      expect(maps.aliasToName.get('西洋美術館')).toBe('国立西洋美術館')

      // Check nameToId map
      expect(maps.nameToId.get('東京国立博物館')).toBe('museum1')
      expect(maps.nameToId.get('国立西洋美術館')).toBe('museum2')
    })

    it('should handle museums without aliases', () => {
      const museums = [
        {
          id: 'museum1',
          name: '東京国立博物館',
          address: '東京都台東区上野公園13-9',
          access: 'JR上野駅から徒歩10分',
          openingInformation: '9:30-17:00',
          officialUrl: 'https://www.tnm.jp/',
          scrapeUrl: 'https://example.com',
          scrapeEnabled: true,
          venueType: '博物館',
          area: '上野',
        },
      ] satisfies Museum[]

      const maps = buildMuseumMaps(museums)

      expect(maps.aliasToName.get('東京国立博物館')).toBe('東京国立博物館')
      expect(maps.nameToId.get('東京国立博物館')).toBe('museum1')
    })

    it('should handle empty museum array', () => {
      const museums: Museum[] = []

      const maps = buildMuseumMaps(museums)

      expect(maps.aliasToName.size).toBe(0)
      expect(maps.nameToId.size).toBe(0)
    })

    it('should map all aliases to the same canonical name', () => {
      const museums = [
        {
          id: 'museum1',
          name: '正式名称',
          address: '東京都千代田区',
          access: 'JR東京駅から徒歩5分',
          openingInformation: '10:00-18:00',
          officialUrl: 'https://example.com',
          scrapeUrl: 'https://example.com',
          scrapeEnabled: true,
          venueType: '美術館',
          area: '上野',
          aliases: ['別名1', '別名2', '別名3'],
        },
      ] satisfies Museum[]

      const maps = buildMuseumMaps(museums)

      expect(maps.aliasToName.get('正式名称')).toBe('正式名称')
      expect(maps.aliasToName.get('別名1')).toBe('正式名称')
      expect(maps.aliasToName.get('別名2')).toBe('正式名称')
      expect(maps.aliasToName.get('別名3')).toBe('正式名称')
    })
  })

  describe('fetchEnabledMuseumsWithUrls', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('should fetch enabled museums and format start URLs', async () => {
      const mockMuseumData: MuseumDocument[] = [
        {
          name: '東京国立博物館',
          address: '東京都台東区上野公園13-9',
          access: 'JR上野駅から徒歩10分',
          openingInformation: '9:30-17:00',
          officialUrl: 'https://www.tnm.jp/',
          scrapeUrl: 'https://museum1.com/exhibitions',
          scrapeEnabled: true,
          venueType: '博物館',
          area: '上野',
          aliases: ['東博'],
        },
        {
          name: '国立西洋美術館',
          address: '東京都台東区上野公園7-7',
          access: 'JR上野駅から徒歩1分',
          openingInformation: '9:30-17:30',
          officialUrl: 'https://www.nmwa.go.jp/',
          scrapeUrl: 'https://museum2.com/exhibitions',
          scrapeEnabled: true,
          venueType: '美術館',
          area: '上野',
          aliases: ['西洋美術館'],
        },
      ]

      const mockDocs = mockMuseumData.map((data, index) => ({
        id: `museum${index + 1}`,
        data: () => data,
      }))

      const mockSnapshot = {
        docs: mockDocs,
      }

      const mockWhere = vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue(mockSnapshot),
      })

      const db = await import('../lib/firestore.js')
      vi.mocked(db.default.collection).mockReturnValue({
        where: mockWhere,
      } as never)

      const result = await fetchEnabledMuseumsWithUrls()

      expect(db.default.collection).toHaveBeenCalledWith('museum')
      expect(mockWhere).toHaveBeenCalledWith('scrapeEnabled', '==', true)

      expect(result.museums).toHaveLength(2)
      expect(result.museums[0]).toEqual({
        id: 'museum1',
        name: '東京国立博物館',
        address: '東京都台東区上野公園13-9',
        access: 'JR上野駅から徒歩10分',
        openingInformation: '9:30-17:00',
        officialUrl: 'https://www.tnm.jp/',
        scrapeUrl: 'https://museum1.com/exhibitions',
        scrapeEnabled: true,
        venueType: '博物館',
        area: '上野',
        aliases: ['東博'],
      })

      expect(result.startUrls).toHaveLength(2)
      expect(result.startUrls[0]).toEqual({
        url: 'https://museum1.com/exhibitions',
        method: 'GET',
      })
      expect(result.startUrls[1]).toEqual({
        url: 'https://museum2.com/exhibitions',
        method: 'GET',
      })
    })

    it('should return empty arrays when no enabled museums exist', async () => {
      const mockSnapshot = {
        docs: [],
      }

      const mockWhere = vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue(mockSnapshot),
      })

      const db = await import('../lib/firestore.js')
      vi.mocked(db.default.collection).mockReturnValue({
        where: mockWhere,
      } as never)

      const result = await fetchEnabledMuseumsWithUrls()

      expect(result.museums).toHaveLength(0)
      expect(result.startUrls).toHaveLength(0)
    })
  })

  describe('fetchAllMuseums', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('should fetch all museums', async () => {
      const mockMuseumData: MuseumDocument[] = [
        {
          name: '東京国立博物館',
          address: '東京都台東区上野公園13-9',
          access: 'JR上野駅から徒歩10分',
          openingInformation: '9:30-17:00',
          officialUrl: 'https://www.tnm.jp/',
          scrapeUrl: 'https://museum1.com/exhibitions',
          scrapeEnabled: true,
          venueType: '博物館',
          area: '上野',
          aliases: ['東博'],
        },
        {
          name: '国立西洋美術館',
          address: '東京都台東区上野公園7-7',
          access: 'JR上野駅から徒歩1分',
          openingInformation: '9:30-17:30',
          officialUrl: 'https://www.nmwa.go.jp/',
          scrapeUrl: 'https://museum2.com/exhibitions',
          scrapeEnabled: false,
          venueType: '美術館',
          area: '上野',
        },
      ]

      const mockDocs = mockMuseumData.map((data, index) => ({
        id: `museum${index + 1}`,
        data: () => data,
      }))

      const mockSnapshot = {
        docs: mockDocs,
      }

      const db = await import('../lib/firestore.js')
      vi.mocked(db.default.collection).mockReturnValue({
        get: vi.fn().mockResolvedValue(mockSnapshot),
      } as never)

      const result = await fetchAllMuseums()

      expect(db.default.collection).toHaveBeenCalledWith('museum')
      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        id: 'museum1',
        name: '東京国立博物館',
        address: '東京都台東区上野公園13-9',
        access: 'JR上野駅から徒歩10分',
        openingInformation: '9:30-17:00',
        officialUrl: 'https://www.tnm.jp/',
        scrapeUrl: 'https://museum1.com/exhibitions',
        scrapeEnabled: true,
        venueType: '博物館',
        area: '上野',
        aliases: ['東博'],
      })
      expect(result[1]).toEqual({
        id: 'museum2',
        name: '国立西洋美術館',
        address: '東京都台東区上野公園7-7',
        access: 'JR上野駅から徒歩1分',
        openingInformation: '9:30-17:30',
        officialUrl: 'https://www.nmwa.go.jp/',
        scrapeUrl: 'https://museum2.com/exhibitions',
        scrapeEnabled: false,
        venueType: '美術館',
        area: '上野',
      })
    })

    it('should return empty array when no museums exist', async () => {
      const mockSnapshot = {
        docs: [],
      }

      const db = await import('../lib/firestore.js')
      vi.mocked(db.default.collection).mockReturnValue({
        get: vi.fn().mockResolvedValue(mockSnapshot),
      } as never)

      const result = await fetchAllMuseums()

      expect(result).toHaveLength(0)
    })
  })
})
