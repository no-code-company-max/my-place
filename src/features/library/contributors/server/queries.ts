import 'server-only'
import { prisma } from '@/db/client'
import type { LibraryCategoryContributor } from '@/features/library/domain/types'

/**
 * Queries de contributors del slice `library`.
 *
 * Cubre lectura de `LibraryCategoryContributor` (designated authors de
 * categorías DESIGNATED) y la decisión derivada
 * `canCreateInAnyCategoryForViewer` que combina policy + membership.
 *
 * RLS está activa sobre `LibraryCategoryContributor` (migration
 * 20260430000000). Acá usamos el `prisma` singleton (service role) que
 * bypassea RLS — el caller debe haber resuelto antes el placeId/viewer
 * via membership para mantener igualdad funcional.
 *
 * Ver `docs/features/library/spec.md` § 10.
 */

/**
 * Lista contributors designated de una categoría con datos de User
 * para renderizar avatar + nombre sin queries N+1.
 */
export async function listCategoryContributors(
  categoryId: string,
): Promise<LibraryCategoryContributor[]> {
  const rows = await prisma.libraryCategoryContributor.findMany({
    where: { categoryId },
    orderBy: { invitedAt: 'asc' },
    select: {
      categoryId: true,
      userId: true,
      invitedAt: true,
      invitedByUserId: true,
      user: {
        select: { displayName: true, avatarUrl: true },
      },
      invitedBy: {
        select: { displayName: true },
      },
    },
  })
  return rows.map((r) => ({
    categoryId: r.categoryId,
    userId: r.userId,
    displayName: r.user.displayName,
    avatarUrl: r.user.avatarUrl,
    invitedAt: r.invitedAt,
    invitedByUserId: r.invitedByUserId,
    invitedByDisplayName: r.invitedBy.displayName,
  }))
}

/**
 * Devuelve solo los userIds de contributors — útil para
 * `canCreateInCategory` sin pagar el JOIN si solo necesitamos auth.
 */
export async function listCategoryContributorUserIds(categoryId: string): Promise<string[]> {
  const rows = await prisma.libraryCategoryContributor.findMany({
    where: { categoryId },
    select: { userId: true },
  })
  return rows.map((r) => r.userId)
}

/**
 * Decide si el viewer tiene permiso de crear items en al menos una
 * categoría no archivada del place. Usado por el `<ZoneFab>` para
 * decidir si mostrar el item "Nuevo recurso" — sin categorías
 * elegibles, el item es un dead-end (UX inútil).
 *
 * Optimizado para los 3 casos:
 *  - admin/owner: siempre true (early return, 0 queries).
 *  - miembro común: hasta 2 queries livianas (count MEMBERS_OPEN +
 *    EXISTS sobre LibraryCategoryContributor con join a la categoría).
 */
export async function canCreateInAnyCategoryForViewer(params: {
  placeId: string
  userId: string
  isAdmin: boolean
}): Promise<boolean> {
  if (params.isAdmin) return true

  const openCount = await prisma.libraryCategory.count({
    where: {
      placeId: params.placeId,
      archivedAt: null,
      contributionPolicy: 'MEMBERS_OPEN',
    },
  })
  if (openCount > 0) return true

  const designatedHit = await prisma.libraryCategoryContributor.findFirst({
    where: {
      userId: params.userId,
      category: {
        placeId: params.placeId,
        archivedAt: null,
        contributionPolicy: 'DESIGNATED',
      },
    },
    select: { categoryId: true },
  })
  return designatedHit !== null
}

/**
 * Batch query: contributors agrupados por `categoryId`. Usada por la
 * page admin para precargar la lista de todas las categorías
 * `DESIGNATED` sin N+1.
 *
 * Devuelve un `Map<categoryId, contributors[]>`. Categorías sin
 * contributors no aparecen en el Map (caller chequea
 * `map.get(id) ?? []`).
 */
export async function listContributorsByCategoryIds(
  categoryIds: ReadonlyArray<string>,
): Promise<Map<string, LibraryCategoryContributor[]>> {
  if (categoryIds.length === 0) return new Map()
  const rows = await prisma.libraryCategoryContributor.findMany({
    where: { categoryId: { in: [...categoryIds] } },
    orderBy: { invitedAt: 'asc' },
    select: {
      categoryId: true,
      userId: true,
      invitedAt: true,
      invitedByUserId: true,
      user: {
        select: { displayName: true, avatarUrl: true },
      },
      invitedBy: {
        select: { displayName: true },
      },
    },
  })
  const map = new Map<string, LibraryCategoryContributor[]>()
  for (const r of rows) {
    const existing = map.get(r.categoryId) ?? []
    existing.push({
      categoryId: r.categoryId,
      userId: r.userId,
      displayName: r.user.displayName,
      avatarUrl: r.user.avatarUrl,
      invitedAt: r.invitedAt,
      invitedByUserId: r.invitedByUserId,
      invitedByDisplayName: r.invitedBy.displayName,
    })
    map.set(r.categoryId, existing)
  }
  return map
}
