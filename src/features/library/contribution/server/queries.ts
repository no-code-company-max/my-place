import 'server-only'
import { cache } from 'react'
import { prisma } from '@/db/client'
import type { WriteAccessKind } from '@/features/library/public'

/**
 * Queries del sub-slice `library/contribution` (S1a, 2026-05-12).
 *
 * Sólo este archivo (más actions) toca Prisma. UI/domain consumen via
 * `public.ts` / `public.server.ts`.
 *
 * Ver `docs/decisions/2026-05-12-library-permissions-model.md`.
 */

/**
 * Shape canónico del write scope de una categoría. Aplana la unión "una
 * de 3 tablas" en un único objeto plano: el caller elige qué array usar
 * según `kind`.
 *
 * Para evaluar `canWriteCategory`, el caller construye el
 * `CategoryWriteContext`:
 *
 *   const scope = await findWriteScope(categoryId)
 *   const ctx = scope ? {
 *     writeAccessKind: scope.kind,
 *     groupWriteIds: scope.groupIds,
 *     tierWriteIds: scope.tierIds,
 *     userWriteIds: scope.userIds,
 *   } : null
 */
export type LibraryCategoryWriteScope = {
  kind: WriteAccessKind
  groupIds: ReadonlyArray<string>
  tierIds: ReadonlyArray<string>
  userIds: ReadonlyArray<string>
}

/**
 * Resuelve el write scope completo de una categoría en 1 query con
 * includes (sin N+1). Cacheable por request via `React.cache` — múltiples
 * componentes en el mismo render comparten el resultado.
 *
 * Retorna `null` si la categoría no existe (NotFound es responsabilidad
 * del caller — la query es shape-pura).
 *
 * Las 3 tablas siempre se traen (sin importar `writeAccessKind`) — esto
 * permite al admin previsualizar/editar el set guardado de cualquier
 * tipo sin re-query. El cap del N de scopes (50 entries) hace que el
 * payload extra sea trivial.
 */
export const findWriteScope = cache(
  async (categoryId: string): Promise<LibraryCategoryWriteScope | null> => {
    const row = await prisma.libraryCategory.findUnique({
      where: { id: categoryId },
      select: {
        writeAccessKind: true,
        writeGroupScopes: { select: { groupId: true } },
        writeTierScopes: { select: { tierId: true } },
        writeUserScopes: { select: { userId: true } },
      },
    })
    if (!row) return null
    return {
      kind: row.writeAccessKind,
      groupIds: row.writeGroupScopes.map((s) => s.groupId),
      tierIds: row.writeTierScopes.map((s) => s.tierId),
      userIds: row.writeUserScopes.map((s) => s.userId),
    }
  },
)

/**
 * ¿Puede el viewer crear contenido en al menos UNA categoría del place?
 *
 * Útil para gate de visibilidad del `<ZoneFab>` "+ Crear" en library.
 * Resuelve internamente owner + scope matches (sin requerir un viewer
 * pre-resuelto desde el caller).
 *
 * Reemplaza al legacy `canCreateInAnyCategoryForViewer` (sub-slice
 * `contributors/` eliminado en S1b).
 *
 * Flow:
 *  1. Owner del place: bypass instantáneo.
 *  2. Check directo en `LibraryCategoryUserWriteScope` (kind=USERS).
 *  3. Resolver grupos del user + check en `LibraryCategoryGroupWriteScope`.
 *  4. Resolver tiers activos del user + check en `LibraryCategoryTierWriteScope`.
 *
 * Las 3 sub-queries son `findFirst` (early-exit en cada nivel) — el
 * costo agregado es ≤ 4 round-trips al pooler. No es cacheable por
 * request (depende del user) pero el shell lo invoca 1 vez por render
 * en `<Suspense>`.
 */
export async function canWriteInAnyCategory(args: {
  placeId: string
  userId: string
}): Promise<boolean> {
  const { placeId, userId } = args

  const isOwner = await prisma.placeOwnership.findUnique({
    where: { userId_placeId: { userId, placeId } },
    select: { id: true },
  })
  if (isOwner) return true

  const userScope = await prisma.libraryCategoryUserWriteScope.findFirst({
    where: {
      userId,
      category: { placeId, archivedAt: null, writeAccessKind: 'USERS' },
    },
    select: { categoryId: true },
  })
  if (userScope) return true

  const groupMemberships = await prisma.groupMembership.findMany({
    where: { userId, placeId },
    select: { groupId: true },
  })
  if (groupMemberships.length > 0) {
    const groupScope = await prisma.libraryCategoryGroupWriteScope.findFirst({
      where: {
        groupId: { in: groupMemberships.map((g) => g.groupId) },
        category: { placeId, archivedAt: null, writeAccessKind: 'GROUPS' },
      },
      select: { categoryId: true },
    })
    if (groupScope) return true
  }

  const now = new Date()
  const tierMemberships = await prisma.tierMembership.findMany({
    where: {
      userId,
      placeId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: { tierId: true },
  })
  if (tierMemberships.length > 0) {
    const tierScope = await prisma.libraryCategoryTierWriteScope.findFirst({
      where: {
        tierId: { in: tierMemberships.map((t) => t.tierId) },
        category: { placeId, archivedAt: null, writeAccessKind: 'TIERS' },
      },
      select: { categoryId: true },
    })
    if (tierScope) return true
  }

  return false
}
