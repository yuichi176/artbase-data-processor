import type { Timestamp } from '@google-cloud/firestore'

type Status = 'active' | 'pending'
type Origin = 'scrape' | 'scrape-feed' | 'manual'

/**
 * Exhibition document structure in Firestore
 */
export interface ExhibitionDocument {
  title: string
  venue: string
  museumId: string
  startDate?: Timestamp
  endDate?: Timestamp
  status: Status
  origin?: Origin
  isExcluded: boolean
  hasDateChanged: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
  officialUrl?: string
}

/**
 * Input exhibition data from scraping services
 */
export interface ScrapedExhibition {
  title: string
  venue: string
  startDate?: string | null | undefined
  endDate?: string | null | undefined
  officialUrl?: string | null | undefined
  imageUrl?: string | null | undefined
}

/**
 * Data structure for creating a new exhibition document
 */
export interface NewExhibitionDocument {
  title: string
  venue: string
  museumId: string
  startDate?: Timestamp
  endDate?: Timestamp
  status: 'pending'
  origin: 'scrape' | 'scrape-feed'
  isExcluded: boolean
  hasDateChanged: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
  officialUrl?: string
}
