import { AuthorizationError, ConflictError, InvariantViolation } from '@/shared/errors/domain-error'
import type { InviterPermissions } from './types'

/**
 * Invariantes del slice `members`. Funciones puras — la barrera real de unicidad
 * y el 150-cap viven también en DB (trigger de 2.G, unique parcial de 2.E).
 *
 * Ver `docs/features/members/spec.md`.
 */

export const PLACE_MAX_MEMBERS = 150
export const INVITATION_TTL_DAYS = 7
export const INVITATION_TOKEN_BYTES = 32

export function assertPlaceHasCapacity(activeCount: number): void {
  if (activeCount >= PLACE_MAX_MEMBERS) {
    throw new InvariantViolation(
      `Un place no puede exceder ${PLACE_MAX_MEMBERS} miembros activos.`,
      { activeCount, limit: PLACE_MAX_MEMBERS },
    )
  }
}

/**
 * Asegura que el inviter tenga permiso de invitar (admin o owner). `isAdmin`
 * cubre owner ⇒ true automáticamente; queda explícito el chequeo combinado
 * por documentación. Ver ADR `2026-05-03-drop-membership-role-rls-impact.md`.
 */
export function assertInviterHasAdminAccess(perms: InviterPermissions): void {
  if (perms.isAdmin) return
  throw new AuthorizationError('Solo owners y admins pueden invitar miembros.', {
    isOwner: perms.isOwner,
    isAdmin: perms.isAdmin,
  })
}

export function assertPlaceActive(place: { archivedAt: Date | null }): void {
  if (place.archivedAt) {
    throw new ConflictError('Este place está archivado.', { archivedAt: place.archivedAt })
  }
}

/**
 * Token de invitación unadivinable: 32 bytes random → base64url (43 chars, espacio 2^256).
 * `crypto.getRandomValues` es Edge-safe. `Buffer.from(...).toString('base64url')` usa Node,
 * que está garantizado en server actions (corren en runtime node, no edge).
 */
export function generateInvitationToken(bytes = INVITATION_TOKEN_BYTES): string {
  const buf = new Uint8Array(bytes)
  crypto.getRandomValues(buf)
  return Buffer.from(buf).toString('base64url')
}
