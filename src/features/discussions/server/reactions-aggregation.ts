import 'server-only'
import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { prisma } from '@/db/client'
import type { ContentTargetKind, ReactionEmoji } from '../domain/types'
import { commentReactionsTag, postReactionsTag } from './reactions-cache'

/**
 * Agregación de reacciones para un batch de targets polimórficos (POST + COMMENT).
 * Se usa en las páginas de lista y detalle para renderizar <ReactionBar> con
 * counts por emoji + flag de "viewer reaccionó".
 *
 * Estrategia: dos queries paralelas.
 *   (1) `groupBy` — counts por `(targetType, targetId, emoji)`.
 *   (2) `findMany` — reactions del viewer sobre esos targets.
 * Se mergean en memoria en un `Map` keyed por `${type}:${id}`.
 *
 * Complejidad: O(targets × emojis). Page de 50 comments + 1 post × 6 emojis ≈
 * 306 filas máximo. Ambas queries usan el índice `(targetType, targetId)`.
 */

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

export function reactionMapKey(type: ContentTargetKind, id: string): string {
  return `${type}:${id}`
}

async function aggregateReactionsRaw(params: {
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

/**
 * Cache de dos capas: `React.cache` per-request (dedup dentro del render
 * tree) sobre `unstable_cache` cross-request (TTL 60s + tag-based
 * invalidation). Key parts: `viewerUserId` + serialización estable de
 * targets — el flag `viewerReacted` depende del viewer, así que cada
 * (viewer, set-de-targets) tiene su propia entry. Tags por target permiten
 * invalidar todas las entries de un POST/COMMENT independiente del viewer
 * cuando muta una `Reaction`. Patrón: `findInviterPermissions` en
 * `members/server/queries.ts:62`.
 */
export const aggregateReactions = cache(
  async (params: {
    targets: ReactionTarget[]
    viewerUserId: string
  }): Promise<ReactionAggregationMap> => {
    if (params.targets.length === 0) return new Map()
    const tags = params.targets.map((t) =>
      t.type === 'POST' ? postReactionsTag(t.id) : commentReactionsTag(t.id),
    )
    const targetKey = params.targets
      .map((t) => `${t.type}:${t.id}`)
      .sort()
      .join(',')
    // `unstable_cache` serializa el return con JSON: un `Map` deserializa
    // como POJO sin `.get()` y rompe los consumers (`reactionsByKey.get(...)`).
    // Cacheamos como array de tuples y re-hidratamos el `Map` fuera del cache.
    // Repro original: cache miss → Map OK → render OK; cache hit (≤60s) →
    // POJO → `TypeError: r.get is not a function` en thread/library detail.
    const entries = await unstable_cache(
      async () => Array.from((await aggregateReactionsRaw(params)).entries()),
      ['reactions', params.viewerUserId, targetKey],
      { tags, revalidate: 60 },
    )()
    return new Map(entries)
  },
)
