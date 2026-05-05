import 'server-only'
import { cache } from 'react'
import { prisma } from '@/db/client'
import { findActiveMembership, findPlaceOwnership } from '@/shared/lib/identity-cache'
import { isLibraryScopedPermission, type Permission } from '@/features/groups/public'

/**
 * Queries de chequeo de permisos atómicos del plan permission-groups.
 *
 * Vive en `members/server/` (no en `groups/`) porque se compone con
 * `findPlaceOwnership` y `findActiveMembership` — primitives de
 * identity-cache que ya viven en members. Patrón coherente con
 * `findInviterPermissions`.
 *
 * **Estado post-cleanup C.3**: la única vía a `true` (fuera del owner bypass)
 * es membership a un grupo de permisos que contenga el permiso solicitado.
 * El fallback legacy `membership.role === 'ADMIN'` fue eliminado junto con
 * la columna `Membership.role` y su enum.
 *
 * Cached con `React.cache` para deduplicar dentro del mismo request
 * (gotcha CLAUDE.md `connection_limit=1`).
 *
 * Ver:
 *   docs/features/groups/spec.md § 11
 *   docs/decisions/2026-05-03-drop-membership-role-rls-impact.md
 *   /Users/maxi/.claude/plans/tidy-stargazing-summit.md § C.3
 */

type HasPermissionOpts = {
  /** Aplica sólo a permisos library:* — restringe el chequeo a una categoría. */
  categoryId?: string
}

/**
 * Chequea si un user tiene un permiso atómico en un place.
 *
 * Owner siempre `true` (dios implícito).
 *
 * Para permisos `library:*` con `opts.categoryId`, considera scope:
 *  - Si algún grupo del user con ese permiso NO tiene scope → global → `true`.
 *  - Si todos los grupos con el permiso tienen scope → matchear `categoryId`.
 */
export const hasPermission = cache(
  async (
    userId: string,
    placeId: string,
    permission: Permission,
    opts: HasPermissionOpts = {},
  ): Promise<boolean> => {
    // 1. Owner bypass.
    const isOwner = await findPlaceOwnership(userId, placeId)
    if (isOwner) return true

    // 2. Membership activa requerida.
    const membership = await findActiveMembership(userId, placeId)
    if (!membership) return false

    // 3. Group memberships con el permiso. Filtramos a nivel DB con
    //    `permissions: { has: permission }` que usa el GIN-able array op.
    const groups = await prisma.groupMembership.findMany({
      where: {
        userId,
        placeId,
        group: { permissions: { has: permission } },
      },
      include: {
        group: {
          select: {
            id: true,
            categoryScopes: { select: { categoryId: true } },
          },
        },
      },
    })
    if (groups.length === 0) return false

    // 4. Library scope (si aplica).
    if (isLibraryScopedPermission(permission) && opts.categoryId !== undefined) {
      // Si algún grupo del user tiene el permiso SIN scope → global → allow.
      const hasUnscoped = groups.some((g) => g.group.categoryScopes.length === 0)
      if (hasUnscoped) return true
      // Sino, alguno debe matchear el categoryId.
      return groups.some((g) =>
        g.group.categoryScopes.some((s) => s.categoryId === opts.categoryId),
      )
    }

    return true
  },
)

type AllowedCategories = { all: true } | { all: false; ids: string[] }

/**
 * Lista las categorías de library donde el user puede ejecutar `permission`.
 * Útil para UI condicional (mostrar/ocultar botones de moderación por
 * categoría).
 *
 * Retorna `{ all: true }` si el user puede en TODAS las categorías
 * (owner OR algún grupo con permiso sin scope).
 * Retorna `{ all: false, ids }` si está restringido a categorías específicas.
 */
export const listAllowedCategoryIds = cache(
  async (userId: string, placeId: string, permission: Permission): Promise<AllowedCategories> => {
    const isOwner = await findPlaceOwnership(userId, placeId)
    if (isOwner) return { all: true }

    const membership = await findActiveMembership(userId, placeId)
    if (!membership) return { all: false, ids: [] }

    const groups = await prisma.groupMembership.findMany({
      where: {
        userId,
        placeId,
        group: { permissions: { has: permission } },
      },
      include: {
        group: { select: { categoryScopes: { select: { categoryId: true } } } },
      },
    })
    if (groups.length === 0) return { all: false, ids: [] }

    // Algún grupo sin scope → all.
    if (groups.some((g) => g.group.categoryScopes.length === 0)) {
      return { all: true }
    }

    // Sino, union de los categoryIds de cada grupo.
    const ids = Array.from(
      new Set(groups.flatMap((g) => g.group.categoryScopes.map((s) => s.categoryId))),
    )
    return { all: false, ids }
  },
)
