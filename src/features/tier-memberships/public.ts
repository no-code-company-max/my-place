/**
 * API pública client-safe del slice `tier-memberships` (M.2).
 *
 * Lo que viaja al bundle cliente: tipos, schemas Zod, Server Action
 * references (Next serializa las actions como referencias — no son código
 * en cliente) y componentes UI client-safe. Para queries Prisma usar
 * `public.server.ts`.
 *
 * **No** incluye queries server-only ni componentes que las usen. Mismo
 * patrón split que `flags/public.ts` + `flags/public.server.ts`
 * (ADR `2026-04-21-flags-subslice-split.md`).
 *
 * Ver `docs/features/tier-memberships/spec.md`.
 */

// ---------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------

export type { AssignedBySnapshot, TierMembership, TierMembershipDetail } from './domain/types'

// ---------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------

export { computeExpiresAt } from './domain/expiration'
export { buildAssignedBySnapshot } from './domain/snapshot'
export { isActiveMembership, isTierAssignable } from './domain/invariants'

// ---------------------------------------------------------------
// Schemas Zod
// ---------------------------------------------------------------

export {
  assignTierInputSchema,
  removeTierAssignmentInputSchema,
  type AssignTierInput,
  type RemoveTierAssignmentInput,
} from './schemas'

// ---------------------------------------------------------------
// Server actions — references viajan client-safe
// ---------------------------------------------------------------

export { assignTierToMemberAction, type AssignTierResult } from './server/actions/assign-tier'
export {
  removeTierAssignmentAction,
  type RemoveTierAssignmentResult,
} from './server/actions/remove-tier-assignment'

// ---------------------------------------------------------------
// UI — Server Components y Client islands client-safe
// ---------------------------------------------------------------

export { AssignedTiersList } from './ui/assigned-tiers-list'
export { RemoveAssignmentButton } from './ui/remove-assignment-button'
export { TierAssignmentControl } from './ui/tier-assignment-control'
export { friendlyTierMembershipErrorMessage } from './ui/errors'
