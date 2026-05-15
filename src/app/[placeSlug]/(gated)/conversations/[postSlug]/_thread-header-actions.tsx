import 'server-only'
import { logger } from '@/shared/lib/logger'
import { PostAdminMenu } from '@/features/discussions/public'
import { resolveViewerForPlace, type Post } from '@/features/discussions/public.server'
import { EventActionsMenu } from '@/features/events/public'
import { getEvent } from '@/features/events/public.server'

type Props = {
  placeId: string
  placeSlug: string
  post: Post
}

/**
 * Streamed rightSlot del `<ThreadHeaderBar>` con el kebab admin / event
 * actions. Vive bajo `<Suspense fallback={null}>` — mientras carga, el
 * header bar muestra sólo el back button (rightSlot vacío). Cuando
 * resuelve el viewer + event lookup, el kebab aparece in-place.
 *
 * Lógica del slot:
 *  - Event-thread + (autor del evento || admin) → `<EventActionsMenu>`.
 *  - Post normal + admin → `<PostAdminMenu>`.
 *  - Otros casos → null (sin kebab).
 *
 * `resolveViewerForPlace` y `getEvent` están cacheados con React.cache
 * per-request, así que si `<ThreadContent>` ya los disparó, esta llamada
 * es 0 round-trips.
 */
export async function ThreadHeaderActions(props: Props): Promise<React.ReactNode> {
  // DEBUG TEMPORAL — ver comentario en `_thread-content.tsx`.
  try {
    return await renderThreadHeaderActions(props)
  } catch (err: unknown) {
    logger.error(
      {
        err,
        scope: 'conversations.thread-header-actions',
        placeSlug: props.placeSlug,
        placeId: props.placeId,
        postId: props.post.id,
        postSlug: props.post.slug,
      },
      'ThreadHeaderActions threw',
    )
    throw err
  }
}

async function renderThreadHeaderActions({
  placeId,
  placeSlug,
  post,
}: Props): Promise<React.ReactNode> {
  const viewer = await resolveViewerForPlace({ placeSlug })

  const eventDetail = post.event
    ? await getEvent({
        eventId: post.event.id,
        placeId,
        viewerUserId: viewer.actorId,
      }).catch((err: unknown) => {
        logger.error({ err, eventId: post.event?.id, placeId }, 'getEvent failed in actions')
        return null
      })
    : null

  const isEventAuthor =
    eventDetail?.authorUserId !== null && eventDetail?.authorUserId === viewer.actorId
  const showEventMenu = eventDetail !== null && (isEventAuthor || viewer.isAdmin)

  if (showEventMenu) {
    return (
      <EventActionsMenu eventId={eventDetail.id} cancelled={eventDetail.state === 'cancelled'} />
    )
  }
  if (viewer.isAdmin) {
    return (
      <PostAdminMenu
        postId={post.id}
        postSlug={post.slug}
        hiddenAt={post.hiddenAt}
        expectedVersion={post.version}
      />
    )
  }
  return null
}
