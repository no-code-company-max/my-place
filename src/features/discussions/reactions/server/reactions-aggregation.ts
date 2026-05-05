import 'server-only'
import { prisma } from '@/db/client'
import {
  reactionMapKey,
  type AggregatedReaction,
  type ReactionAggregationMap,
  type ReactionTarget,
} from './aggregation-types'

/** O(targets × emojis). Page de 50 comments + 1 post × 6 emojis ≈ 306 filas. */
export async function aggregateReactions(params: {
  targets: ReactionTarget[]
  viewerUserId: string
}): Promise<ReactionAggregationMap> {
  const result: ReactionAggregationMap = new Map()
  if (params.targets.length === 0) return result

  const orClauses = params.targets.map((t) => ({
    targetType: t.type,
    targetId: t.id,
  }))

  const [grouped, viewerRows] = await Promise.all([
    prisma.reaction.groupBy({
      by: ['targetType', 'targetId', 'emoji'],
      where: { OR: orClauses },
      _count: { _all: true },
    }),
    prisma.reaction.findMany({
      where: { userId: params.viewerUserId, OR: orClauses },
      select: { targetType: true, targetId: true, emoji: true },
    }),
  ])

  const viewerSet = new Set(viewerRows.map((r) => `${r.targetType}:${r.targetId}:${r.emoji}`))

  for (const g of grouped) {
    const key = reactionMapKey(g.targetType, g.targetId)
    const entry: AggregatedReaction = {
      emoji: g.emoji,
      count: g._count._all,
      viewerReacted: viewerSet.has(`${g.targetType}:${g.targetId}:${g.emoji}`),
    }
    const existing = result.get(key)
    if (existing) {
      existing.push(entry)
    } else {
      result.set(key, [entry])
    }
  }

  return result
}
