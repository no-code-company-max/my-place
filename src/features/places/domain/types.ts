import type { BillingMode } from '@prisma/client'

/**
 * Tipos de dominio del slice `places`. Puros, sin dependencias de Next/React.
 * Prisma es OK porque define el enum a nivel schema (fuente canónica del modelo).
 */

export type PlaceId = string
export type Slug = string

export type Place = {
  id: PlaceId
  slug: Slug
  name: string
  description: string | null
  billingMode: BillingMode
  archivedAt: Date | null
  createdAt: Date
}

/**
 * Place del que el viewer es miembro activo.
 *
 * `isAdmin`: membership al `PermissionGroup` preset del place — owner ⇒
 * true. Reemplazó al legacy `Membership.role === 'ADMIN'` durante el
 * cleanup G.7 (ADR `2026-05-03-drop-membership-role-rls-impact.md`).
 */
export type MyPlace = Place & {
  isOwner: boolean
  isAdmin: boolean
  joinedAt: Date
}

export { type BillingMode } from '@prisma/client'
