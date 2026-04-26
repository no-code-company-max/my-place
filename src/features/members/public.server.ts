import 'server-only'

/**
 * API server-only del slice `members`. Queries Prisma + componentes
 * que las consumen + jobs (erasure 365d). Solo importable desde
 * Server Components, Server Actions, Route Handlers o background tasks.
 *
 * Mismo patrón split que `flags/public.server.ts` (ADR
 * `2026-04-21-flags-subslice-split.md`). Pages y layouts que necesitan
 * estos exports importan desde `@/features/members/public.server`;
 * todo lo client-safe vive en `public.ts`.
 */

// Queries (server-only)
export {
  findInvitationById,
  findInvitationByToken,
  findInviterPermissions as findMemberPermissions,
  findMemberProfile,
  listActiveMembers,
  listPendingInvitationsByPlace,
  type ActiveMember,
  type InvitationWithDelivery,
  type InvitationWithPlace,
  type MemberProfile,
} from './server/queries'

// Server-only UI (consume queries internamente)
export { PendingInvitationsList } from './ui/pending-invitations-list'

// Background jobs (cron, etc.)
export { runErasure } from './server/erasure/run-erasure'
export type { ErasureRunResult } from './server/erasure/types'
