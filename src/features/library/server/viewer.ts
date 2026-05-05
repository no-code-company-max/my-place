import 'server-only'
import { cache } from 'react'
import { prisma } from '@/db/client'
import { resolveActorForPlace, type DiscussionActor } from '@/features/discussions/public.server'
import { findPlaceOwnership } from '@/shared/lib/identity-cache'
import type { LibraryViewer } from '@/features/library/public'

/**
 * Combina viewer (para canX checks) + actor (para queries cross-slice +
 * revalidatePath). Cacheable React.cache por request.
 *
 * ADR `docs/decisions/2026-05-04-library-courses-and-read-access.md` § D7.
 */
export type LibraryViewerContext = {
  viewer: LibraryViewer
  actor: DiscussionActor
}

export const resolveLibraryViewer = cache(
  async (params: { placeSlug?: string; placeId?: string }): Promise<LibraryViewerContext> => {
    const actor = await resolveActorForPlace(params)

    const [isOwner, groupRows, tierRows] = await Promise.all([
      findPlaceOwnership(actor.actorId, actor.placeId),
      prisma.groupMembership.findMany({
        where: { userId: actor.actorId, placeId: actor.placeId },
        select: { groupId: true },
      }),
      prisma.tierMembership.findMany({
        where: {
          userId: actor.actorId,
          placeId: actor.placeId,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        select: { tierId: true },
      }),
    ])

    return {
      viewer: {
        userId: actor.actorId,
        isAdmin: actor.isAdmin,
        isOwner,
        groupIds: groupRows.map((r) => r.groupId),
        tierIds: tierRows.map((r) => r.tierId),
      },
      actor,
    }
  },
)
