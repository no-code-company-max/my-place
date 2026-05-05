import 'server-only'
import { prisma } from '@/db/client'
import type { ReaderForStack } from '@/features/discussions/domain/types'
import { findOrCreateCurrentOpening } from '@/features/discussions/presence/server/place-opening'

/**
 * Queries del agregado `PostRead` (lectores de un post). Vive aparte de
 * `posts.ts` para mantener cada archivo bajo el cap de 300 LOC. Los helpers
 * `fetchLastReadByPostId`, `fetchCommentCountByPostId` y
 * `fetchReadersSampleByPostId` son internos al subdirectorio `queries/` —
 * `posts.ts` los importa para construir el `PostListView`.
 */

/**
 * Proyección de un lector del post durante una apertura específica. Shape
 * consumido por el componente UI `PostReadersBlock`. El `userId` permite
 * linkear al perfil contextual del miembro (`/m/<userId>`).
 */
export type PostReader = {
  userId: string
  displayName: string
  avatarUrl: string | null
  readAt: Date
}

/**
 * Lista lectores de un post durante una apertura específica (`placeOpeningId`).
 *
 * Reglas de filtrado (en línea con la ontología `docs/ontologia/
 * conversaciones.md § Tres` y spec § PostRead):
 *
 * - **Ex-miembros excluidos**: solo lectores con `Membership` activa
 *   (`leftAt IS NULL`) en el mismo place aparecen. Derecho al olvido
 *   estructurado: quien salió no debe seguir visible como lector.
 * - **Viewer excluido opcionalmente**: `excludeUserId` filtra al viewer
 *   actual — simetría con `ThreadPresence` que oculta al viewer de la
 *   presencia live.
 * - **Orden `readAt DESC`**: el lector más reciente primero (coherente con
 *   el texto ontológico "hasta ahora").
 *
 * Sin límite de filas — el cap es 150 miembros/place por invariante del
 * dominio; el consumidor UI hace slice(0, 8) visual. Index
 * `(postId, placeOpeningId)` garantiza que la query es sub-milisegundo.
 */
export async function listReadersByPost(params: {
  postId: string
  placeId: string
  placeOpeningId: string
  excludeUserId?: string
}): Promise<PostReader[]> {
  const rows = await prisma.postRead.findMany({
    where: {
      postId: params.postId,
      placeOpeningId: params.placeOpeningId,
      ...(params.excludeUserId ? { userId: { not: params.excludeUserId } } : {}),
      user: {
        memberships: {
          some: {
            placeId: params.placeId,
            leftAt: null,
          },
        },
      },
    },
    select: {
      userId: true,
      readAt: true,
      user: { select: { displayName: true, avatarUrl: true } },
    },
    orderBy: { readAt: 'desc' },
  })
  return rows.map((row) => ({
    userId: row.userId,
    displayName: row.user.displayName,
    avatarUrl: row.user.avatarUrl,
    readAt: row.readAt,
  }))
}

/**
 * Agrupa `PostRead` por `postId` tomando el `max(readAt)` del viewer. Un único
 * round-trip extra; sin viewer o sin posts, short-circuit a Map vacío.
 */
export async function fetchLastReadByPostId(params: {
  viewerUserId: string | undefined
  postIds: string[]
}): Promise<Map<string, Date>> {
  if (!params.viewerUserId || params.postIds.length === 0) return new Map()
  const rows = await prisma.postRead.groupBy({
    by: ['postId'],
    where: { userId: params.viewerUserId, postId: { in: params.postIds } },
    _max: { readAt: true },
  })
  const map = new Map<string, Date>()
  for (const row of rows) {
    if (row._max.readAt) map.set(row.postId, row._max.readAt)
  }
  return map
}

/**
 * Cuenta comments activos (deletedAt IS NULL) por `postId`. Soft-deleted
 * excluidos para consistency con la UI que no muestra placeholders en el
 * count. Un solo groupBy. Sin posts, short-circuit a Map vacío.
 */
export async function fetchCommentCountByPostId(postIds: string[]): Promise<Map<string, number>> {
  if (postIds.length === 0) return new Map()
  const rows = await prisma.comment.groupBy({
    by: ['postId'],
    where: { postId: { in: postIds }, deletedAt: null },
    _count: { id: true },
  })
  const map = new Map<string, number>()
  for (const row of rows) {
    map.set(row.postId, row._count.id)
  }
  return map
}

/**
 * Top 4 readers por `postId` de la **apertura actual** del place — para el
 * `<ReaderStack>` en la lista de threads (R.6).
 *
 * Approach: una sola query `findMany` sobre `PostRead` filtrada por
 * `placeOpeningId = currentOpeningId AND postId IN (...)`, joins a `User`
 * para `displayName` + `avatarUrl`, ordered por `readAt DESC`. Filtramos
 * client-side al top 4 por post. Aceptable porque el cap es 150
 * miembros/place — el peor caso es ~150 readers por post × 50 posts =
 * 7500 rows en una page, manageable.
 *
 * Si el place no tiene opening activa (`unconfigured` o ventana cerrada),
 * cae a Map vacío silencioso. El `<ReaderStack>` con array vacío no se
 * renderiza (mismo silencio que `<PostReadersBlock>` en el detail).
 *
 * **Ex-miembros excluidos**: solo readers con `Membership` activa
 * (`leftAt IS NULL`) en el mismo place aparecen — alineado con
 * `listReadersByPost` en el detail (derecho al olvido estructurado).
 */
export async function fetchReadersSampleByPostId(params: {
  placeId: string
  postIds: string[]
}): Promise<Map<string, ReaderForStack[]>> {
  if (params.postIds.length === 0) return new Map()
  const opening = await findOrCreateCurrentOpening(params.placeId).catch(() => null)
  if (!opening) return new Map()

  const rows = await prisma.postRead.findMany({
    where: {
      placeOpeningId: opening.id,
      postId: { in: params.postIds },
      user: {
        memberships: { some: { placeId: params.placeId, leftAt: null } },
      },
    },
    orderBy: { readAt: 'desc' },
    select: {
      postId: true,
      userId: true,
      user: { select: { displayName: true, avatarUrl: true } },
    },
  })

  const map = new Map<string, ReaderForStack[]>()
  for (const row of rows) {
    const existing = map.get(row.postId) ?? []
    if (existing.length >= 4) continue
    existing.push({
      userId: row.userId,
      displayName: row.user.displayName,
      avatarUrl: row.user.avatarUrl,
    })
    map.set(row.postId, existing)
  }
  return map
}
