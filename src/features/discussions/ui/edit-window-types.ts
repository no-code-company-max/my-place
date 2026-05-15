/**
 * Tipos compartidos entre `EditWindowActions` y `EditWindowConfirmDelete`.
 * Vive como archivo separado para romper ciclos (el root importa los
 * sub-components, y éstos necesitan los tipos).
 *
 * Posts: "Editar" (navega a la page dedicada) + "Eliminar". Comments:
 * solo "Eliminar" (su edición inline es flujo aparte, fuera de F.4). El
 * campo `body` se preserva para que el delete confirm pueda mostrar
 * excerpt si el producto lo decide en el futuro.
 */

import type { LexicalDocument } from '@/features/rich-text/public'

export type PostSubject = {
  kind: 'post'
  postId: string
  /** Slug del post — destino del botón "Editar" (`/conversations/<slug>/edit`). */
  slug: string
  title: string
  body: LexicalDocument | null
  createdAt: Date
  version: number
  placeSlug: string
}

export type CommentSubject = {
  kind: 'comment'
  body: LexicalDocument | null
  commentId: string
  createdAt: Date
  version: number
}

export type EditWindowSubject = PostSubject | CommentSubject

export type EditSessionState =
  | { state: 'loading' }
  | { state: 'ready'; session: { token: string; openedAt: string } | null }
  | { state: 'error'; message: string }
