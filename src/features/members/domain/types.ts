import type { InvitationDeliveryStatus } from '@prisma/client'

/**
 * Tipos de dominio del slice `members`. Puros, sin Next/React.
 */

export type InvitationId = string

export type Invitation = {
  id: InvitationId
  placeId: string
  email: string
  invitedBy: string
  asAdmin: boolean
  /**
   * Si true, el invitee acepta como owner del place (suma `PlaceOwnership`
   * además de `Membership`). App-layer enforce mutual exclusion con
   * `asAdmin` (ver migration 20260503010000 + ADR
   * `2026-05-03-drop-membership-role-rls-impact.md`).
   */
  asOwner: boolean
  acceptedAt: Date | null
  expiresAt: Date
  token: string
}

export type InvitationDelivery = {
  deliveryStatus: InvitationDeliveryStatus
  providerMessageId: string | null
  lastDeliveryError: string | null
  lastSentAt: Date | null
}

export type PendingInvitation = Invitation &
  InvitationDelivery & {
    inviter: { displayName: string }
  }

export { type InvitationDeliveryStatus } from '@prisma/client'

/**
 * Snapshot de permisos del actor sobre un place, al momento de consultar.
 *
 * `isMember`: tiene `Membership` activa (sin `leftAt`) en el place. Sirve
 * como gate de acceso de ruta — los layouts de place chequean esto antes
 * de renderizar contenido. Owner sin membership es excepción: `isMember`
 * será `false` aunque `isOwner` sea `true` (caso edge de scaffolding).
 *
 * `isAdmin`: membership al `PermissionGroup` preset del place
 * (`isPreset === true`) — owner ⇒ true. Reemplazó al legacy
 * `Membership.role === 'ADMIN'` durante el cleanup G.7
 * (ADR `2026-05-03-drop-membership-role-rls-impact.md`).
 */
export type InviterPermissions = {
  isMember: boolean
  isOwner: boolean
  isAdmin: boolean
}
