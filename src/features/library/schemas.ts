/**
 * Zod schemas de input de server actions del slice `library` (R.7.2).
 *
 * Validan la forma del input que viene del cliente. Las reglas de
 * negocio (cap, slug format, etc.) viven en `domain/invariants.ts` —
 * acá solo validación estructural: tipos + length caps.
 *
 * Ver `docs/features/library/spec.md` § 10 + § 11.
 */

import { z } from 'zod'
import { libraryItemDocumentSchema } from '@/features/rich-text/public'
import { POST_TITLE_MAX_LENGTH, POST_TITLE_MIN_LENGTH } from '@/features/discussions/public'
import {
  CATEGORY_EMOJI_MAX_LENGTH,
  CATEGORY_EMOJI_MIN_LENGTH,
  CATEGORY_TITLE_MAX_LENGTH,
  CATEGORY_TITLE_MIN_LENGTH,
  ITEM_COVER_URL_MAX_LENGTH,
} from './domain/invariants'
import { LIBRARY_CATEGORY_KIND_VALUES } from './domain/types'

// ---------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------

const titleSchema = z
  .string()
  .min(CATEGORY_TITLE_MIN_LENGTH)
  .max(CATEGORY_TITLE_MAX_LENGTH)
  .refine((s) => s.trim().length >= CATEGORY_TITLE_MIN_LENGTH, {
    message: 'El título no puede estar vacío después de quitar espacios.',
  })

const emojiSchema = z.string().min(CATEGORY_EMOJI_MIN_LENGTH).max(CATEGORY_EMOJI_MAX_LENGTH)

const categoryKindSchema = z.enum([
  'GENERAL',
  'COURSE',
] as const satisfies readonly (typeof LIBRARY_CATEGORY_KIND_VALUES)[number][])

// ---------------------------------------------------------------
// Inputs por action
// ---------------------------------------------------------------

export const createCategoryInputSchema = z.object({
  placeId: z.string().min(1),
  emoji: emojiSchema,
  title: titleSchema,
  /** G.5+6.b (2026-05-04): GENERAL = lista plana, COURSE = wizard prereqs. */
  kind: categoryKindSchema.optional().default('GENERAL'),
})
export type CreateCategoryInput = z.infer<typeof createCategoryInputSchema>

export const updateCategoryInputSchema = z.object({
  categoryId: z.string().min(1),
  emoji: emojiSchema,
  title: titleSchema,
  kind: categoryKindSchema.optional(),
})
export type UpdateCategoryInput = z.infer<typeof updateCategoryInputSchema>

export const archiveCategoryInputSchema = z.object({
  categoryId: z.string().min(1),
})
export type ArchiveCategoryInput = z.infer<typeof archiveCategoryInputSchema>

export const reorderCategoriesInputSchema = z.object({
  placeId: z.string().min(1),
  /** Orden deseado: lista de categoryIds en la posición visual final.
   *  El index del array es la posición. La action hace UPDATE en una
   *  tx por idempotencia. */
  orderedCategoryIds: z.array(z.string().min(1)).min(1).max(50),
})
export type ReorderCategoriesInput = z.infer<typeof reorderCategoriesInputSchema>

// ---------------------------------------------------------------
// Items (R.7.6)
// ---------------------------------------------------------------

const itemTitleSchema = z
  .string()
  .min(POST_TITLE_MIN_LENGTH)
  .max(POST_TITLE_MAX_LENGTH)
  .refine((s) => s.trim().length >= POST_TITLE_MIN_LENGTH, {
    message: 'El título no puede estar vacío después de quitar espacios.',
  })

const coverUrlSchema = z.string().max(ITEM_COVER_URL_MAX_LENGTH).nullable().optional()

export const createItemInputSchema = z.object({
  placeId: z.string().min(1),
  categoryId: z.string().min(1),
  title: itemTitleSchema,
  body: libraryItemDocumentSchema,
  coverUrl: coverUrlSchema,
})
export type CreateItemInput = z.infer<typeof createItemInputSchema>

export const updateItemInputSchema = z.object({
  itemId: z.string().min(1),
  title: itemTitleSchema,
  body: libraryItemDocumentSchema,
  coverUrl: coverUrlSchema,
  /** Versión del Post al momento de abrir el editor (optimistic locking).
   *  Si otro editor pisó el item entremedio, `updateMany` matchea 0 filas
   *  → ConflictError. Ver `update-item.ts`. */
  expectedVersion: z.number().int().min(0),
})
export type UpdateItemInput = z.infer<typeof updateItemInputSchema>

export const archiveItemInputSchema = z.object({
  itemId: z.string().min(1),
})
export type ArchiveItemInput = z.infer<typeof archiveItemInputSchema>
