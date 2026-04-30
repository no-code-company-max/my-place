import { z } from 'zod'

/**
 * Filtros de la lista de discusiones (R.6 follow-up).
 *
 * - `all`: todos los posts (default).
 * - `unanswered`: posts sin comments activos (`commentCount === 0`).
 *   Soft-deleted no cuentan, consistente con el commentCount
 *   aggregation en `listPostsByPlace`.
 * - `participating`: viewer es autor del post O hizo al menos un
 *   comment activo (deletedAt IS NULL). Requiere `viewerUserId`.
 *
 * Pure module sin dependencias de runtime (excepto Zod). Reusable
 * server + client. Ver `docs/features/discussions/spec.md § 21.4`.
 */
export const POST_LIST_FILTERS = ['all', 'unanswered', 'participating'] as const
export type PostListFilter = (typeof POST_LIST_FILTERS)[number]

/**
 * Schema con `.catch('all')`: si la URL trae un valor inválido (manual
 * edition, scrape), fallback silencioso a 'all' sin throw. Defensivo
 * para parsing en el borde (URL params son user input externo).
 */
export const postListFilterSchema = z.enum(POST_LIST_FILTERS).catch('all')

/**
 * Parser tolerante para `searchParams.filter`. Acepta string,
 * undefined o null y siempre devuelve un `PostListFilter` válido
 * (default 'all').
 */
export function parsePostListFilter(raw: string | undefined | null): PostListFilter {
  return postListFilterSchema.parse(raw ?? 'all')
}
