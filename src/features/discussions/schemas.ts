/**
 * Zod schemas de input de server actions del slice `discussions`.
 *
 * Los schemas del TipTap AST viven en `domain/rich-text-schemas.ts` (tipo puro
 * del dominio). Los consumidores siguen importando `richTextDocumentSchema`
 * desde acá por compat — este archivo lo re-exporta.
 *
 * Ver `docs/features/discussions/spec.md` § 4 (shape).
 */

import { z } from 'zod'
import {
  POST_TITLE_MAX_LENGTH,
  POST_TITLE_MIN_LENGTH,
  REACTION_EMOJI_DISPLAY,
} from './domain/invariants'
import { richTextDocumentSchema } from './domain/rich-text-schemas'

// Re-export del schema del AST + su tipo inferido.
export { richTextDocumentSchema } from './domain/rich-text-schemas'
export type { RichTextDocumentParsed } from './domain/rich-text-schemas'

// ---------------------------------------------------------------
// Inputs de server actions
// ---------------------------------------------------------------

const postTitleSchema = z
  .string()
  .min(POST_TITLE_MIN_LENGTH)
  .max(POST_TITLE_MAX_LENGTH)
  .refine((s) => s.trim().length > 0, {
    message: 'El título no puede ser sólo espacios.',
  })

export const createPostInputSchema = z.object({
  placeId: z.string().min(1),
  title: postTitleSchema,
  body: richTextDocumentSchema.nullable().optional(),
})

export type CreatePostInput = z.infer<typeof createPostInputSchema>

export const createCommentInputSchema = z.object({
  postId: z.string().min(1),
  body: richTextDocumentSchema,
  quotedCommentId: z.string().min(1).nullable().optional(),
})

export type CreateCommentInput = z.infer<typeof createCommentInputSchema>

/**
 * Edit-session token emitido por `openPostEditSession` / `openCommentEditSession`.
 * Sólo exigido a non-admins. Ver `shared/lib/edit-session-token.ts` +
 * `docs/decisions/2026-04-21-edit-session-token.md`.
 */
const editSessionSchema = z.object({
  token: z.string().min(1),
  openedAt: z.string().datetime(),
})

export const editPostInputSchema = z.object({
  postId: z.string().min(1),
  title: postTitleSchema,
  body: richTextDocumentSchema.nullable().optional(),
  expectedVersion: z.number().int().nonnegative(),
  session: editSessionSchema.optional(),
})

export type EditPostInput = z.infer<typeof editPostInputSchema>

export const editCommentInputSchema = z.object({
  commentId: z.string().min(1),
  body: richTextDocumentSchema,
  expectedVersion: z.number().int().nonnegative(),
  session: editSessionSchema.optional(),
})

export type EditCommentInput = z.infer<typeof editCommentInputSchema>

export const openPostEditSessionInputSchema = z.object({
  postId: z.string().min(1),
})

export type OpenPostEditSessionInput = z.infer<typeof openPostEditSessionInputSchema>

export const openCommentEditSessionInputSchema = z.object({
  commentId: z.string().min(1),
})

export type OpenCommentEditSessionInput = z.infer<typeof openCommentEditSessionInputSchema>

const targetKindSchema = z.enum(['POST', 'COMMENT'])
const reactionEmojiSchema = z.enum(REACTION_EMOJI_DISPLAY)

export const reactInputSchema = z.object({
  targetType: targetKindSchema,
  targetId: z.string().min(1),
  emoji: reactionEmojiSchema,
})

export type ReactInput = z.infer<typeof reactInputSchema>

export const unreactInputSchema = z.object({
  targetType: targetKindSchema,
  targetId: z.string().min(1),
  emoji: reactionEmojiSchema,
})

export type UnreactInput = z.infer<typeof unreactInputSchema>

export const hidePostInputSchema = z.object({
  postId: z.string().min(1),
  expectedVersion: z.number().int().nonnegative(),
})

export type HidePostInput = z.infer<typeof hidePostInputSchema>

export const unhidePostInputSchema = hidePostInputSchema
export type UnhidePostInput = HidePostInput

export const deletePostInputSchema = z.object({
  postId: z.string().min(1),
  expectedVersion: z.number().int().nonnegative(),
})

export type DeletePostInput = z.infer<typeof deletePostInputSchema>

export const deleteCommentInputSchema = z.object({
  commentId: z.string().min(1),
  expectedVersion: z.number().int().nonnegative(),
})

export type DeleteCommentInput = z.infer<typeof deleteCommentInputSchema>

export const markPostReadInputSchema = z.object({
  postId: z.string().min(1),
  dwellMs: z
    .number()
    .int()
    .min(0)
    .max(24 * 60 * 60 * 1000),
})

export type MarkPostReadInput = z.infer<typeof markPostReadInputSchema>
