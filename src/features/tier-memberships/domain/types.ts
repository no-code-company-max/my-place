/**
 * Tipos del dominio del slice `tier-memberships` (M.2).
 *
 * Tipos puros — sin Prisma, sin Next, sin React. Las queries mapean rows
 * de Prisma a estos shapes; las actions y la UI consumen estos tipos.
 *
 * Ver `docs/features/tier-memberships/spec.md` § 2 + § 8 y
 * `docs/decisions/2026-05-02-tier-memberships-model.md`.
 */

import type { Tier } from '@/features/tiers/public'

/**
 * Snapshot del usuario que asignó el tier — congelado al momento de asignar.
 *
 * Sobrevive aunque el assigner pase por erasure 365d (su `User.displayName`
 * se renombra a "ex-miembro" pero este snapshot queda intacto). Patrón
 * canónico Post/Comment/Flag/Event — ver
 * `docs/decisions/2026-04-24-erasure-365d.md` § "Snapshots".
 *
 * Cuando llegue Stripe (Fase 3), las asignaciones automáticas vendrán con
 * `displayName: 'Stripe'` y `avatarUrl: null`.
 */
export type AssignedBySnapshot = {
  displayName: string
  avatarUrl: string | null
}

/**
 * Vista canónica de una asignación de tier — 1:1 con la row de
 * `TierMembership` (sin computed fields v1).
 *
 * `expiresAt = null` ⇒ asignación indefinida (vive hasta que el owner la
 * remueva manualmente). Si presente, calculado de
 * `assignedAt + tierDurationToDays(tier.duration)` al asignar. v1 sólo
 * lo guarda informativo; el cron de expiración + paywall llegan en Fase 3.
 */
export type TierMembership = {
  id: string
  tierId: string
  userId: string
  placeId: string
  assignedAt: Date
  assignedByUserId: string | null
  assignedBySnapshot: AssignedBySnapshot
  expiresAt: Date | null
  updatedAt: Date
}

/**
 * Detalle de una asignación con el `Tier` joined. Se hidrata en una sola
 * query con `include: { tier: true }` — NO N+1.
 *
 * Es el shape que consume `<AssignedTiersList>` para renderizar nombre de
 * tier + label de expiración sin lookups adicionales.
 */
export type TierMembershipDetail = TierMembership & {
  tier: Tier
}
