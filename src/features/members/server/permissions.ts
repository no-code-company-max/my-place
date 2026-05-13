import 'server-only'
import { cache } from 'react'
import { prisma } from '@/db/client'
import { findActiveMembership, findPlaceOwnership } from '@/shared/lib/identity-cache'
import type { Permission } from '@/features/groups/public'

/**
 * Queries de chequeo de permisos atómicos del plan permission-groups.
 *
 * Vive en `members/server/` (no en `groups/`) porque se compone con
 * `findPlaceOwnership` y `findActiveMembership` — primitives de
 * identity-cache que ya viven en members.
 *
 * **Estado post-cleanup C.3**: la única vía a `true` (fuera del owner bypass)
 * es membership a un grupo de permisos que contenga el permiso solicitado.
 *
 * **S1b (2026-05-13):** removido el sistema `GroupCategoryScope` —
 * permisos `library:*` aplican ahora globalmente al place (no scopables
 * por categoría). El opts `categoryId` se mantiene en la firma por
 * compatibilidad con callers existentes pero ya no afecta el resultado.
 *
 * Cached con `React.cache` para deduplicar dentro del mismo request.
 *
 * Ver:
 *   docs/features/groups/spec.md § 11
 *   docs/decisions/2026-05-12-library-permissions-model.md
 */

type HasPermissionOpts = {
  /** **Deprecated post-S1b** — los permisos library:* son globales. Se
   *  mantiene el campo en la firma para no romper callers; ignorado al
   *  evaluar. Quitar en cleanup futuro. */
  categoryId?: string
}

/**
 * Chequea si un user tiene un permiso atómico en un place.
 *
 * Owner siempre `true` (dios implícito). Para otros, basta con que
 * pertenezca a algún grupo con ese permiso en su array.
 */
export const hasPermission = cache(
  async (
    userId: string,
    placeId: string,
    permission: Permission,
    _opts: HasPermissionOpts = {},
  ): Promise<boolean> => {
    const isOwner = await findPlaceOwnership(userId, placeId)
    if (isOwner) return true

    const membership = await findActiveMembership(userId, placeId)
    if (!membership) return false

    // findMany (no count) para mantener mocks de tests existentes que
    // stubbean `groupMembership.findMany` y porque el set es chico (≤ N
    // grupos del user, típicamente < 5).
    const groups = await prisma.groupMembership.findMany({
      where: {
        userId,
        placeId,
        group: { permissions: { has: permission } },
      },
      select: { id: true },
    })
    return groups.length > 0
  },
)

type AllowedCategories = { all: true } | { all: false; ids: string[] }

/**
 * Lista las categorías de library donde el user puede ejecutar `permission`.
 *
 * **S1b:** ahora los permisos library son globales — devuelve siempre
 * `{ all: true }` si el user tiene el permiso (vía owner bypass o
 * algún grupo). Si no, `{ all: false, ids: [] }`.
 */
export const listAllowedCategoryIds = cache(
  async (userId: string, placeId: string, permission: Permission): Promise<AllowedCategories> => {
    const hasIt = await hasPermission(userId, placeId, permission)
    return hasIt ? { all: true } : { all: false, ids: [] }
  },
)
