import { z } from 'zod'
import { scrapedExhibitionSchema } from './exhibition.schema.js'

/**
 * Schema for Apify actor response from regular scraping
 * Includes officialUrl and imageUrl fields
 */
export const apifyResponseSchema = z
  .array(
    z.object({
      jsonAnswer: z
        .object({
          exhibitions: z.array(scrapedExhibitionSchema).default([]),
        })
        .optional(),
    }),
  )
  .transform((arr) =>
    arr.flatMap((obj) =>
      (obj.jsonAnswer?.exhibitions ?? []).map((ex) => ({
        ...ex,
        status: 'pending' as const,
      })),
    ),
  )

/**
 * Schema for Apify actor response from feed scraping
 * Excludes officialUrl and imageUrl fields as they are not available in feeds
 */
export const apifyFeedResponseSchema = z
  .array(
    z.object({
      jsonAnswer: z
        .object({
          exhibitions: z
            .array(
              scrapedExhibitionSchema.omit({
                officialUrl: true,
                imageUrl: true,
              }),
            )
            .default([]),
        })
        .optional(),
    }),
  )
  .transform((arr) =>
    arr.flatMap((obj) =>
      (obj.jsonAnswer?.exhibitions ?? []).map((ex) => ({
        ...ex,
        status: 'pending' as const,
      })),
    ),
  )
