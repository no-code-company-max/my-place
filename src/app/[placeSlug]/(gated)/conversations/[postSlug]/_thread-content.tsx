import 'server-only'
import { notFound } from 'next/navigation'
import { logger } from '@/shared/lib/logger'
import { DwellTracker, ThreadPresence } from '@/features/discussions/public'
import { PostDetail, resolveViewerForPlace, type Post } from '@/features/discussions/public.server'
import { EventMetadataHeader } from '@/features/events/public'
import { getEvent } from '@/features/events/public.server'
import { buildMentionResolvers } from '@/app/[placeSlug]/(gated)/_mention-resolvers'

type Props = {
  placeSlug: string
  placeId: string
  post: Post
}

/**
 * Streamed body del thread detail (R.6.4). Este Server Component vive
 * bajo `<Suspense>` en el page para que el shell + ThreadHeaderBar
 * pinten en ~150ms post-TTFB. Las queries que requieren viewer / event
 * happen acá: ~700ms cold (4 queries de viewer + getEvent), pero el
 * skeleton del page hace que el user no vea pantalla en blanco.
 *
 * Maneja:
 *  - Hidden post check (admin-only): notFound desde Suspense child
 *    causa flicker pero es caso raro de moderación, aceptable.
 *  - Event-thread vs standalone post: branching idéntico al pre-refactor.
 *  - DwellTracker / ThreadPresence client components con viewer info.
 *
 * Patrón "streaming agresivo del shell" — ver `docs/architecture.md`.
 */
export async function ThreadContent({ placeSlug, placeId, post }: Props): Promise<React.ReactNode> {
  const viewer = await resolveViewerForPlace({ placeSlug })
  if (post.hiddenAt && !viewer.isAdmin) notFound()

  const eventDetail = post.event
    ? await getEvent({
        eventId: post.event.id,
        placeId,
        viewerUserId: viewer.actorId,
      }).catch((err: unknown) => {
        logger.error({ err, eventId: post.event?.id, placeId }, 'getEvent failed')
        return null
      })
    : null

  return (
    <>
      <DwellTracker postId={post.id} />
      <ThreadPresence
        postId={post.id}
        viewer={{
          userId: viewer.actorId,
          displayName: viewer.user.displayName,
          avatarUrl: viewer.user.avatarUrl,
        }}
      />

      {eventDetail ? (
        <>
          <EventMetadataHeader event={eventDetail} placeSlug={viewer.placeSlug} />
          <div className="mx-3 mt-6 border-t-[0.5px] border-border" />
        </>
      ) : (
        <PostDetail
          post={post}
          viewerUserId={viewer.actorId}
          placeSlug={viewer.placeSlug}
          mentionResolvers={buildMentionResolvers({ placeId })}
        />
      )}
    </>
  )
}
