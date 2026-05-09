import { Suspense } from 'react'
import { notFound, permanentRedirect } from 'next/navigation'
import { loadPlaceBySlug } from '@/shared/lib/place-loader'
import { ORIGIN_ZONE_HREF, parseBackHref, parseOriginZone } from '@/shared/lib/back-origin'
import { logger } from '@/shared/lib/logger'
import { ThreadHeaderBar } from '@/features/discussions/public'
import { findPostBySlug } from '@/features/discussions/public.server'
import { CommentsSection, CommentsSkeleton } from './_comments-section'
import { ThreadContent } from './_thread-content'
import { ThreadHeaderActions } from './_thread-header-actions'
import { ThreadContentSkeleton } from './_skeletons'

type Props = {
  params: Promise<{ placeSlug: string; postSlug: string }>
  searchParams: Promise<{ from?: string; back?: string }>
}

/**
 * Detalle del thread (R.6.4 layout). **Patrón canónico de streaming
 * agresivo del shell** — top-level await SÓLO para el check de
 * existencia (loadPlace + findPost cacheados). Todo el resto streama:
 *
 *  - `<ThreadHeaderBar>` pinta inmediato con back button.
 *  - `<ThreadContent>` (Suspense) → fetch viewer + event detail. Resuelve
 *    en ~700ms cold; mientras tanto el skeleton del body matched-dimension.
 *  - `<CommentsSection>` (Suspense) → fetch comments + reactions + readers.
 *    Resuelve en ~1s cold; skeleton aparte.
 *  - `<ThreadHeaderActions>` (Suspense, fallback null) → admin kebab,
 *    aparece in-place cuando viewer + event resuelven.
 *
 * Cada Suspense child fetchea sus dependencies independientemente.
 * `React.cache` per-request dedupea queries compartidas (viewer, event)
 * entre los 3 children — 1 query física por request aunque la pidan
 * todos.
 *
 * Cross-zona redirect (R.7.9): Posts que son items de biblioteca
 * redirigen a la URL canónica `/library/[cat]/[slug]`. Se resuelve en
 * el top-level (sync `permanentRedirect`) para que el browser no vea
 * skeletons antes del 308.
 *
 * Ver `docs/architecture.md` § "Streaming agresivo del shell".
 */
export default async function PostDetailPage({ params, searchParams }: Props) {
  const { placeSlug, postSlug } = await params
  // DEBUG TEMPORAL — wrappear los awaits top-level con logging para ver
  // si el throw está acá (vs los Suspense children que ya están wrappeados).
  const place = await loadPlaceBySlug(placeSlug).catch((err: unknown) => {
    logger.error(
      { err, scope: 'conversations.detail.loadPlaceBySlug', placeSlug, postSlug },
      'loadPlaceBySlug threw',
    )
    throw err
  })
  if (!place) notFound()

  const post = await findPostBySlug(place.id, postSlug).catch((err: unknown) => {
    logger.error(
      { err, scope: 'conversations.detail.findPostBySlug', placeSlug, placeId: place.id, postSlug },
      'findPostBySlug threw',
    )
    throw err
  })
  if (!post) notFound()
  if (post.libraryItem) {
    permanentRedirect(`/library/${post.libraryItem.categorySlug}/${post.slug}`)
  }

  // Resolución del back href con prioridad explícita:
  //  1. `?back=<URL>` — cross-thread (mention en otro thread). Prioridad
  //     máxima: vuelve al thread origen específico, no a la zona.
  //  2. `?from=<zone>` — origen por zona (cards de listado, redirects
  //     post-publish). Event-thread + `?from=events` → `/events`.
  //  3. Default — `/conversations` (URL canónica del thread).
  // El composer de creación usa `router.replace`, así que `/conversations/new`
  // nunca queda en el history stack.
  // Ver `docs/decisions/2026-05-09-back-navigation-origin.md`.
  const { from, back } = await searchParams
  const explicitBack = parseBackHref(back)
  const origin = parseOriginZone(from)
  const backHref =
    explicitBack ??
    (post.event && origin === 'events' ? ORIGIN_ZONE_HREF.events : ORIGIN_ZONE_HREF.conversations)

  return (
    <div className="pb-32">
      <ThreadHeaderBar
        backHref={backHref}
        rightSlot={
          <Suspense fallback={null}>
            <ThreadHeaderActions placeId={place.id} placeSlug={placeSlug} post={post} />
          </Suspense>
        }
      />
      <Suspense fallback={<ThreadContentSkeleton />}>
        <ThreadContent placeSlug={placeSlug} placeId={place.id} post={post} />
      </Suspense>
      <Suspense fallback={<CommentsSkeleton />}>
        <CommentsSection
          placeId={place.id}
          placeSlug={placeSlug}
          postId={post.id}
          postSlug={post.slug}
        />
      </Suspense>
    </div>
  )
}
