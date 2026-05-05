import 'server-only'
import { revalidatePath } from 'next/cache'

/**
 * Verbo de la action que dispara la revalidación. Define qué paths se invalidan:
 *  - `'create'`: bumpea `Post.lastActivityAt` (re-ordena listing) e incrementa
 *    `commentCount`. Listing + thread.
 *  - `'edit'`: NO bumpea `lastActivityAt`, NO cambia `commentCount`. Solo el body
 *    del comment cambia, y el listing no muestra body de comments. Solo thread.
 *  - `'delete'`: NO bumpea `lastActivityAt` pero decrementa `commentCount` (el
 *    listing lo muestra en cada row). Listing + thread.
 */
type CommentRevalidateKind = 'create' | 'edit' | 'delete'

/**
 * Revalida las rutas afectadas por un cambio sobre un comment.
 *
 * El thread del post (`/conversations/{postSlug}`) siempre se invalida — el SSR
 * renderiza la lista de comments. El listing (`/conversations`) solo se invalida
 * cuando la action afecta ranking (`lastActivityAt`) o counts (`commentCount`)
 * — los edits son no-op para el listing y se omiten.
 *
 * NO revalidamos `/${placeSlug}` (la home): hoy es un placeholder estático
 * (Fase 7 del roadmap) que no consume queries de discussions. Cuando llegue la
 * portada real, se evalúa qué necesita revalidate.
 *
 * Helper server-only (sin `'use server'`) consumido por los action files del
 * directorio.
 */
export function revalidateCommentPaths(
  placeSlug: string,
  postSlug: string,
  kind: CommentRevalidateKind,
): void {
  revalidatePath(`/${placeSlug}/conversations/${postSlug}`)
  if (kind !== 'edit') {
    revalidatePath(`/${placeSlug}/conversations`)
  }
}
