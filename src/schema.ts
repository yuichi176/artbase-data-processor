import { z } from 'zod'

export const apifyResponseSchema = z
  .array(
    z.object({
      jsonAnswer: z.object({
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
      }),
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
