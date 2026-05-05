/**
 * Types puros del aggregator (sin server-only) — para que UI cliente
 * pueda importarlos sin arrastrar Prisma al bundle.
 */

import type { ContentTargetKind, ReactionEmoji } from '@/features/discussions/domain/types'

export type AggregatedReaction = {
  emoji: ReactionEmoji
  count: number
  viewerReacted: boolean
}

export type ReactionTarget = {
  type: ContentTargetKind
  id: string
}

export type ReactionAggregationMap = Map<string, AggregatedReaction[]>

/** Función pura — safe en bundle cliente. */
export function reactionMapKey(type: ContentTargetKind, id: string): string {
  return `${type}:${id}`
}
