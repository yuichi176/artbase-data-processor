import { z } from 'zod'

/**
 * Schema for exhibition data scraped from museum websites via Apify
 */
export const scrapedExhibitionSchema = z.object({
  title: z.string(),
  venue: z.string(),
  startDate: z.string().nullish(),
  endDate: z.string().nullish(),
  officialUrl: z.string().nullish(),
  imageUrl: z.string().nullish(),
})
export type ScrapedExhibition = z.infer<typeof scrapedExhibitionSchema>
