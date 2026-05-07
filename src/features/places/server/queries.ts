import 'server-only'
import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { prisma } from '@/db/client'
import type { MyPlace, Place, Slug } from '../domain/types'
import { myPlacesTag } from './cache'

/**
 * Queries del slice `places`. Solo este archivo + `actions.ts` tocan Prisma.
 */

export async function findPlaceBySlug(slug: Slug): Promise<Place | null> {
  const row = await prisma.place.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      billingMode: true,
      archivedAt: true,
      createdAt: true,
    },
  })
  return row
}

/**
 * Lista los places del usuario: membresías activas (sin `leftAt`),
 * con flag `isOwner` derivado de la existencia de `PlaceOwnership` del mismo user.
 * Por default excluye places archivados — usar `includeArchived: true` para incluirlos.
 *
 * `isAdmin` (G.7 cleanup additive): batch lookup de `GroupMembership` del
 * user a los preset groups de los places listados — owner ⇒ true. Una sola
 * query plana sobre el set de placeIds; sin N+1.
 */
async function listMyPlacesRaw(
  userId: string,
  opts: { includeArchived?: boolean } = {},
): Promise<MyPlace[]> {
  const rows = await prisma.membership.findMany({
    where: {
      userId,
      leftAt: null,
      ...(opts.includeArchived ? {} : { place: { archivedAt: null } }),
    },
    include: {
      place: {
        include: {
          ownerships: { where: { userId }, select: { userId: true } },
        },
      },
    },
    orderBy: { joinedAt: 'asc' },
  })
  if (rows.length === 0) return []

  const placeIds = rows.map((r) => r.place.id)
  const presetMemberships = await prisma.groupMembership.findMany({
    where: { userId, placeId: { in: placeIds }, group: { isPreset: true } },
    select: { placeId: true },
  })
  const adminPlaceIds = new Set(presetMemberships.map((g) => g.placeId))

  return rows.map((row) => {
    const isOwner = row.place.ownerships.length > 0
    return {
      id: row.place.id,
      slug: row.place.slug,
      name: row.place.name,
      description: row.place.description,
      billingMode: row.place.billingMode,
      archivedAt: row.place.archivedAt,
      createdAt: row.place.createdAt,
      isOwner,
      isAdmin: isOwner || adminPlaceIds.has(row.place.id),
      joinedAt: row.joinedAt,
    }
  })
}

/**
 * Cache cross-request via `unstable_cache`. Key: `(userId, includeArchived)`.
 * Tag `my-places:${userId}` invalidado desde mutations que afecten el set de
 * places del user (ver `cache.ts`). `revalidate: 60` es floor de safety si el
 * tag se pierde (ej. deploy reset). `React.cache` envuelve por encima para
 * deduplicar dentro del render tree.
 */
export const listMyPlaces = cache(
  async (userId: string, opts: { includeArchived?: boolean } = {}): Promise<MyPlace[]> => {
    return unstable_cache(
      () => listMyPlacesRaw(userId, opts),
      ['my-places', userId, String(opts.includeArchived ?? false)],
      {
        tags: [myPlacesTag(userId)],
        revalidate: 60,
      },
    )()
  },
)

export async function findPlaceOwnership(
  userId: string,
  placeId: string,
): Promise<{ userId: string; placeId: string } | null> {
  const row = await prisma.placeOwnership.findUnique({
    where: { userId_placeId: { userId, placeId } },
    select: { userId: true, placeId: true },
  })
  return row
}
