import 'server-only'
import { cache } from 'react'
import { prisma } from '@/db/client'
import type { LibraryReadAccessKind } from '@/features/library/public'

/**
 * Queries del sub-slice `library/access` (G.2.a).
 *
 * Sólo este archivo (más actions) toca Prisma. UI/domain consumen via
 * `public.ts` / `public.server.ts`.
 *
 * Ver `docs/decisions/2026-05-04-library-courses-and-read-access.md` § D6.
 */

/**
 * Shape canónico del read scope de una categoría. Aplana la unión "una de
 * 3 tablas" en un único objeto plano: el caller elige qué array usar
 * según `kind`.
 *
 * Para evaluar `canReadCategory`, el caller construye el `CategoryReadContext`:
 *   const scope = await findReadScope(categoryId)
 *   const ctx = scope ? { readAccessKind: scope.kind, groupReadIds: scope.groupIds, ... } : null
 */
export type LibraryCategoryReadScope = {
  kind: LibraryReadAccessKind
  groupIds: ReadonlyArray<string>
  tierIds: ReadonlyArray<string>
  userIds: ReadonlyArray<string>
}

/**
 * Resuelve el read scope completo de una categoría en 1 query con
 * includes (sin N+1). Cacheable por request via `React.cache` — múltiples
 * componentes en el mismo render comparten el resultado.
 *
 * Retorna `null` si la categoría no existe (NotFound es responsabilidad
 * del caller — la query es shape-pura).
 *
 * Las 3 tablas siempre se traen (sin importar `readAccessKind`) — esto
 * permite al admin previsualizar/editar el set guardado de cualquier
 * tipo sin re-query. El cap del N de scopes (50 entries) hace que el
 * payload extra sea trivial.
 */
export const findReadScope = cache(
  async (categoryId: string): Promise<LibraryCategoryReadScope | null> => {
    const row = await prisma.libraryCategory.findUnique({
      where: { id: categoryId },
      select: {
        readAccessKind: true,
        readGroupScopes: { select: { groupId: true } },
        readTierScopes: { select: { tierId: true } },
        readUserScopes: { select: { userId: true } },
      },
    })
    if (!row) return null
    return {
      kind: row.readAccessKind,
      groupIds: row.readGroupScopes.map((s) => s.groupId),
      tierIds: row.readTierScopes.map((s) => s.tierId),
      userIds: row.readUserScopes.map((s) => s.userId),
    }
  },
)
