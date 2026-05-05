import 'server-only'

/**
 * API server-only del sub-slice `discussions/reactions/`.
 *
 * `aggregateReactions` toca Prisma y nunca debe viajar al bundle cliente.
 * UI cliente que necesite el TYPE `AggregatedReaction` lo importa de
 * `public.ts` (sólo type, no runtime).
 */

export { aggregateReactions } from './server/reactions-aggregation'

// Re-export types desde public.ts para callers que sólo importen de public.server.
export {
  reactionMapKey,
  type AggregatedReaction,
  type ReactionAggregationMap,
  type ReactionTarget,
} from './server/aggregation-types'
