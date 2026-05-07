import 'server-only'
import { revalidateTag } from 'next/cache'

/**
 * Tags + helpers de invalidación para el cache `unstable_cache` que envuelve
 * `aggregateReactions` (ver `./reactions-aggregation.ts`). Cada (target,
 * viewerUserId) genera su propia entry en el cache; los tags son por target,
 * de modo que la mutation invalida todas las entries del mismo POST/COMMENT
 * independientemente del viewer.
 *
 * Patrón: `findInviterPermissions` en `members/server/queries.ts:62` —
 * `React.cache` envuelve `unstable_cache` con tag granular + `revalidate: 60`
 * como safety net si el invalidate se pierde.
 *
 * Llamado desde `reactAction` / `unreactAction` en
 * `./actions/reactions.ts`. Convive con `revalidatePath`: la tag-based
 * invalidation se SUMA, no reemplaza.
 */

export function postReactionsTag(postId: string): string {
  return `post:${postId}:reactions`
}

export function commentReactionsTag(commentId: string): string {
  return `comment:${commentId}:reactions`
}

export function revalidateReactionsForPost(postId: string): void {
  revalidateTag(postReactionsTag(postId))
}

export function revalidateReactionsForComment(commentId: string): void {
  revalidateTag(commentReactionsTag(commentId))
}
