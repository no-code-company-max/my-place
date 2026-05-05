/**
 * Zod schemas de input de las server actions del slice `tier-memberships`
 * (M.2).
 *
 * Validan estructura del input que viene del cliente. Las reglas de
 * negocio (visibility=PUBLISHED, target activo, etc.) viven en
 * `domain/invariants.ts` + las propias actions — Zod cubre estructura.
 *
 * Ver `docs/features/tier-memberships/spec.md` § 9.
 */

import { z } from 'zod'

const placeSlugSchema = z.string().min(1).max(80)
const userIdSchema = z.string().min(1)
const tierIdSchema = z.string().min(1)
const tierMembershipIdSchema = z.string().min(1)

export const assignTierInputSchema = z.object({
  placeSlug: placeSlugSchema,
  memberUserId: userIdSchema,
  tierId: tierIdSchema,
  /**
   * Si `true`, la asignación es indefinida (`expiresAt = null`). Si `false`
   * (default), la action calcula `expiresAt` desde `tier.duration`.
   */
  indefinite: z.boolean().default(false),
})
export type AssignTierInput = z.infer<typeof assignTierInputSchema>

export const removeTierAssignmentInputSchema = z.object({
  /**
   * Identifica el row a remover por `tierMembershipId` explícito (no por
   * `(tierId, userId)` — evita race con asignación concurrente). Decisión
   * #15 ADR.
   */
  tierMembershipId: tierMembershipIdSchema,
})
export type RemoveTierAssignmentInput = z.infer<typeof removeTierAssignmentInputSchema>
