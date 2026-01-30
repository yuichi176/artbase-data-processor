import { z } from 'zod'

/**
 * Schema for museum documents stored in Firestore
 */
export const museumDocumentSchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string(),
  access: z.string(),
  openingInformation: z.string(),
  officialUrl: z.string(),
  scrapeUrl: z.string(),
  aliases: z.array(z.string()).optional(),
  scrapeEnabled: z.boolean(),
  venueType: z.string(),
  area: z.string(),
})
export type Museum = z.infer<typeof museumDocumentSchema>
