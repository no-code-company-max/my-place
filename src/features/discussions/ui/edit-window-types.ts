/**
 * Tipos compartidos entre `EditWindowActions`, `EditWindowForm` y
 * `EditWindowConfirmDelete`. Vive como archivo separado para romper ciclos
 * (el root importa los sub-components, y éstos necesitan los tipos).
 */

import type { RichTextDocument } from '../domain/types'

export type PostSubject = {
  kind: 'post'
  postId: string
  title: string
  body: RichTextDocument | null
  createdAt: Date
  version: number
  placeSlug: string
}

export type CommentSubject = {
  kind: 'comment'
  commentId: string
  body: RichTextDocument
  createdAt: Date
  version: number
}

export type EditWindowSubject = PostSubject | CommentSubject

export type EditSessionState =
  | { state: 'loading' }
  | { state: 'ready'; session: { token: string; openedAt: string } | null }
  | { state: 'error'; message: string }
