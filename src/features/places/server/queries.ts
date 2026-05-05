import 'server-only'
import { prisma } from '@/db/client'
import type { MyPlace, Place, Slug } from '../domain/types'

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
export async function listMyPlaces(
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
