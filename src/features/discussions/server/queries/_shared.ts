import 'server-only'

/**
 * Tipos compartidos entre `posts.ts` y `comments.ts`. Mantiene el cursor
 * keyset en un único lugar para evitar duplicación entre las dos paginaciones
 * `(createdAt DESC, id DESC)` del slice.
 */

export type Cursor = { createdAt: Date; id: string }
