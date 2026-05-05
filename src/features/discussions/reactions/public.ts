/**
 * API pública del sub-slice `discussions/reactions/`.
 *
 * Reactions CRUD + aggregator + UI bar. Independiente de posts/comments
 * (la entidad Reaction tiene FK a target POST|COMMENT pero la API no
 * acopla con el ciclo de vida de esos targets).
 */

export { reactAction, unreactAction } from './server/actions/reactions'

// Types + helper pure (sin server-only) viven en aggregation-types.ts.
// Las queries server-only viven en `public.server.ts`.
export {
  reactionMapKey,
  type AggregatedReaction,
  type ReactionAggregationMap,
  type ReactionTarget,
} from './server/aggregation-types'

export { ReactionBar } from './ui/reaction-bar'
