import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runActorAndGetResults } from './apify.service.js'
import { ExternalServiceError } from '../errors/app-error.js'
import type { ApifyActorInput } from '../types/apify.js'

// Mock Apify client
vi.mock('../lib/apify.js', () => ({
  default: {
    actor: vi.fn(),
    dataset: vi.fn(),
  },
}))

interface MockExhibition {
  title: string
  venue: string
  startDate: string
  endDate: string
}

describe('apify.service', () => {
  describe('runActorAndGetResults', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('should successfully run actor and return results', async () => {
      const actorId = 'test-actor-id'
      const input = {
        startUrls: [{ url: 'https://example.com', method: 'GET' }],
        maxCrawlingDepth: 2,
      } as ApifyActorInput

      const mockResults: MockExhibition[] = [
        {
          title: '特別展1',
          venue: '東京国立博物館',
          startDate: '2024-01-01',
          endDate: '2024-03-31',
        },
        {
          title: '特別展2',
          venue: '国立西洋美術館',
          startDate: '2024-02-01',
          endDate: '2024-04-30',
        },
      ]

      const mockRun = {
        defaultDatasetId: 'dataset-123',
      }

      const mockCall = vi.fn().mockResolvedValue(mockRun)
      const mockListItems = vi.fn().mockResolvedValue({ items: mockResults })

      const apifyClient = await import('../lib/apify.js')
      vi.mocked(apifyClient.default.actor).mockReturnValue({
        call: mockCall,
      } as never)
      vi.mocked(apifyClient.default.dataset).mockReturnValue({
        listItems: mockListItems,
      } as never)

      const result = await runActorAndGetResults<MockExhibition>(actorId, input)

      expect(apifyClient.default.actor).toHaveBeenCalledWith(actorId)
      expect(mockCall).toHaveBeenCalledWith(input, { timeout: 300 })
      expect(apifyClient.default.dataset).toHaveBeenCalledWith('dataset-123')
      expect(mockListItems).toHaveBeenCalled()
      expect(result).toEqual(mockResults)
      expect(result).toHaveLength(2)
    })

    it('should return empty array when no results', async () => {
      const actorId = 'test-actor-id'
      const input = {
        startUrls: [{ url: 'https://example.com', method: 'GET' }],
      } as ApifyActorInput

      const mockRun = {
        defaultDatasetId: 'dataset-123',
      }

      const mockCall = vi.fn().mockResolvedValue(mockRun)
      const mockListItems = vi.fn().mockResolvedValue({ items: [] })

      const apifyClient = await import('../lib/apify.js')
      vi.mocked(apifyClient.default.actor).mockReturnValue({
        call: mockCall,
      } as never)
      vi.mocked(apifyClient.default.dataset).mockReturnValue({
        listItems: mockListItems,
      } as never)

      const result = await runActorAndGetResults<MockExhibition>(actorId, input)

      expect(result).toEqual([])
      expect(result).toHaveLength(0)
    })

    it('should throw ExternalServiceError when actor call fails', async () => {
      const actorId = 'test-actor-id'
      const input = {
        startUrls: [{ url: 'https://example.com', method: 'GET' }],
      } as ApifyActorInput

      const mockCall = vi.fn().mockRejectedValue(new Error('Actor execution failed'))

      const apifyClient = await import('../lib/apify.js')
      vi.mocked(apifyClient.default.actor).mockReturnValue({
        call: mockCall,
      } as never)

      await expect(runActorAndGetResults<MockExhibition>(actorId, input)).rejects.toThrow(
        ExternalServiceError,
      )
      await expect(runActorAndGetResults<MockExhibition>(actorId, input)).rejects.toThrow(
        'Failed to run Apify actor: Actor execution failed',
      )
    })

    it('should throw ExternalServiceError when dataset fetch fails', async () => {
      const actorId = 'test-actor-id'
      const input = {
        startUrls: [{ url: 'https://example.com', method: 'GET' }],
      } as ApifyActorInput

      const mockRun = {
        defaultDatasetId: 'dataset-123',
      }

      const mockCall = vi.fn().mockResolvedValue(mockRun)
      const mockListItems = vi.fn().mockRejectedValue(new Error('Failed to fetch dataset'))

      const apifyClient = await import('../lib/apify.js')
      vi.mocked(apifyClient.default.actor).mockReturnValue({
        call: mockCall,
      } as never)
      vi.mocked(apifyClient.default.dataset).mockReturnValue({
        listItems: mockListItems,
      } as never)

      await expect(runActorAndGetResults<MockExhibition>(actorId, input)).rejects.toThrow(
        ExternalServiceError,
      )
      await expect(runActorAndGetResults<MockExhibition>(actorId, input)).rejects.toThrow(
        'Failed to run Apify actor: Failed to fetch dataset',
      )
    })

    it('should throw ExternalServiceError with generic message for non-Error objects', async () => {
      const actorId = 'test-actor-id'
      const input = {
        startUrls: [{ url: 'https://example.com', method: 'GET' }],
      } as ApifyActorInput

      const mockCall = vi.fn().mockRejectedValue('String error')

      const apifyClient = await import('../lib/apify.js')
      vi.mocked(apifyClient.default.actor).mockReturnValue({
        call: mockCall,
      } as never)

      await expect(runActorAndGetResults<MockExhibition>(actorId, input)).rejects.toThrow(
        ExternalServiceError,
      )
      await expect(runActorAndGetResults<MockExhibition>(actorId, input)).rejects.toThrow(
        'Failed to run Apify actor: Unknown error',
      )
    })

    it('should call actor with correct timeout', async () => {
      const actorId = 'test-actor-id'
      const input = {
        startUrls: [{ url: 'https://example.com', method: 'GET' }],
        maxCrawlingDepth: 3,
      } as ApifyActorInput

      const mockRun = {
        defaultDatasetId: 'dataset-123',
      }

      const mockCall = vi.fn().mockResolvedValue(mockRun)
      const mockListItems = vi.fn().mockResolvedValue({ items: [] })

      const apifyClient = await import('../lib/apify.js')
      vi.mocked(apifyClient.default.actor).mockReturnValue({
        call: mockCall,
      } as never)
      vi.mocked(apifyClient.default.dataset).mockReturnValue({
        listItems: mockListItems,
      } as never)

      await runActorAndGetResults<MockExhibition>(actorId, input)

      expect(mockCall).toHaveBeenCalledWith(input, { timeout: 300 })
    })

    it('should preserve result types', async () => {
      interface CustomResult {
        id: string
        data: { value: number }
      }

      const actorId = 'test-actor-id'
      const input = {
        startUrls: [{ url: 'https://example.com', method: 'GET' }],
      } as ApifyActorInput

      const mockResults: CustomResult[] = [
        { id: '1', data: { value: 100 } },
        { id: '2', data: { value: 200 } },
      ]

      const mockRun = {
        defaultDatasetId: 'dataset-123',
      }

      const mockCall = vi.fn().mockResolvedValue(mockRun)
      const mockListItems = vi.fn().mockResolvedValue({ items: mockResults })

      const apifyClient = await import('../lib/apify.js')
      vi.mocked(apifyClient.default.actor).mockReturnValue({
        call: mockCall,
      } as never)
      vi.mocked(apifyClient.default.dataset).mockReturnValue({
        listItems: mockListItems,
      } as never)

      const result = await runActorAndGetResults<CustomResult>(actorId, input)

      expect(result).toEqual(mockResults)
      expect(result[0].id).toBe('1')
      expect(result[0].data.value).toBe(100)
    })
  })
})
