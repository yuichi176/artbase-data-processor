import { z } from 'zod'

export const apifyResponseSchema = z
  .array(
    z.object({
      jsonAnswer: z
        .object({
          exhibitions: z
            .array(
              z.object({
                title: z.string(),
                venue: z.string(),
                startDate: z.string().nullish(),
                endDate: z.string().nullish(),
                officialUrl: z.string().nullish(),
                imageUrl: z.string().nullish(),
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

const venueTypeSchema = z.enum(['美術館', '博物館', 'ギャラリー'])
export const museumSchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string(),
  access: z.string(),
  openingInformation: z.string(),
  venueType: venueTypeSchema,
  officialUrl: z.string(),
  scrapeUrl: z.string(),
  aliases: z.array(z.string()).optional(),
  scrapeEnabled: z.boolean(),
})
export type Museum = z.infer<typeof museumSchema>
