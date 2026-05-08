import { Suspense } from 'react'
import { notFound, permanentRedirect } from 'next/navigation'
import { loadPlaceBySlug } from '@/shared/lib/place-loader'
import { ThreadHeaderBar } from '@/features/discussions/public'
import { findPostBySlug } from '@/features/discussions/public.server'
import { CommentsSection, CommentsSkeleton } from './_comments-section'
import { ThreadContent } from './_thread-content'
import { ThreadHeaderActions } from './_thread-header-actions'
import { ThreadContentSkeleton } from './_skeletons'

type Props = { params: Promise<{ placeSlug: string; postSlug: string }> }

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
export default async function PostDetailPage({ params }: Props) {
  const { placeSlug, postSlug } = await params
  const place = await loadPlaceBySlug(placeSlug)
  if (!place) notFound()

  const post = await findPostBySlug(place.id, postSlug)
  if (!post) notFound()
  if (post.libraryItem) {
    permanentRedirect(`/library/${post.libraryItem.categorySlug}/${post.slug}`)
  }

  return (
    <div className="pb-32">
      <ThreadHeaderBar
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
        <CommentsSection placeId={place.id} placeSlug={placeSlug} postId={post.id} />
      </Suspense>
    </div>
  )
}
