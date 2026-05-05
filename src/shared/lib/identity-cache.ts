import 'server-only'
import { cache } from 'react'
import { prisma } from '@/db/client'

/**
 * Primitives de identidad cacheados por request (`React.cache`). Todo lo que
 * el árbol layout → gated layout → page → action necesita para resolver
 * "¿quién es el viewer en este place?" pasa por acá — un lookup por
 * `(userId, placeId)` o `(userId)` se resuelve una sola vez por render.
 *
 * Pattern establecido por `loadPlaceBySlug` (`place-loader.ts`): helpers
 * genéricos que múltiples features consumen por primary key primitivo viven
 * en `shared/lib/`. CLAUDE.md reserva `shared/` para esto y prohíbe al
 * reverso (shared nunca importa de features).
 *
 * Ver `docs/decisions/2026-04-20-request-scoped-identity-cache.md`.
 */

export const findActiveMembership = cache(
  async (userId: string, placeId: string): Promise<{ id: string } | null> => {
    return prisma.membership.findFirst({
      where: { userId, placeId, leftAt: null },
      select: { id: true },
    })
  },
)

export const findPlaceOwnership = cache(
  async (userId: string, placeId: string): Promise<boolean> => {
    const row = await prisma.placeOwnership.findUnique({
      where: { userId_placeId: { userId, placeId } },
      select: { userId: true },
    })
    return row !== null
  },
)

export const findUserProfile = cache(
  async (userId: string): Promise<{ displayName: string; avatarUrl: string | null } | null> => {
    return prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true, avatarUrl: true },
    })
  },
)

/**
 * `true` si el `userId` es membership de algún `PermissionGroup` preset del
 * place (`group.isPreset === true`, naming convencional "Administradores").
 * Reemplaza el legacy `Membership.role === 'ADMIN'` durante el cleanup G.7
 * (ver `docs/decisions/2026-05-03-drop-membership-role-rls-impact.md`).
 *
 * Owner del place NO se chequea acá — los callers que necesiten "owner OR
 * admin" componen con `findPlaceOwnership` (ver
 * `members/server/queries.ts:findInviterPermissions` y
 * `directory/server/directory-queries.ts:findMemberDetailForOwner`).
 */
export const findIsPlaceAdmin = cache(async (userId: string, placeId: string): Promise<boolean> => {
  const row = await prisma.groupMembership.findFirst({
    where: { userId, placeId, group: { isPreset: true } },
    select: { id: true },
  })
  return row !== null
})
