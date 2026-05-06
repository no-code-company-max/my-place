/**
 * Zod schemas de input de server actions del slice `discussions`.
 *
 * F.2 (2026-05-06): los campos `body` se validan contra el schema Lexical
 * importado del slice `rich-text`. `Post.body` y `Event.description` son
 * nullables (un post puede no tener body cuando es item de biblioteca o
 * thread del evento sin descripción). `Comment.body` es NOT NULL.
 *
 * Ver `docs/features/discussions/spec.md` § 4 (shape) +
 * `docs/features/rich-text/spec.md` (modelo del documento).
 */

import { z } from 'zod'
import { commentDocumentSchema, postDocumentSchema } from '@/features/rich-text/public'
import {
  POST_TITLE_MAX_LENGTH,
  POST_TITLE_MIN_LENGTH,
  REACTION_EMOJI_DISPLAY,
} from './domain/invariants'

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
  body: postDocumentSchema.nullable().optional(),
})

export type CreatePostInput = z.infer<typeof createPostInputSchema>

export const createCommentInputSchema = z.object({
  postId: z.string().min(1),
  body: commentDocumentSchema,
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
  body: postDocumentSchema.nullable().optional(),
  expectedVersion: z.number().int().nonnegative(),
  session: editSessionSchema.optional(),
})

export type EditPostInput = z.infer<typeof editPostInputSchema>

export const editCommentInputSchema = z.object({
  commentId: z.string().min(1),
  body: commentDocumentSchema,
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
