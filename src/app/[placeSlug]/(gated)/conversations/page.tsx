import { notFound } from 'next/navigation'
import { loadPlaceBySlug } from '@/shared/lib/place-loader'
import { PostList, listPostsByPlace, resolveViewerForPlace } from '@/features/discussions/public'

type Props = { params: Promise<{ placeSlug: string }> }

/**
 * Lista de discusiones del place (R.6). La primera página se arma SSR
 * (`listPostsByPlace` extendido con snippet/commentCount/readerSample/
 * isFeatured); `<PostList>` compone el chrome (SectionHeader + Filter
 * pills + Featured + Rows) y delega el scroll extra al Client Component
 * `<LoadMorePosts>`.
 *
 * Crear o editar un post vive en su propio route `/conversations/new`
 * (con `?edit=<postId>`). El CTA "Nueva" vive ahora dentro de
 * `<ThreadsSectionHeader>` (no más header local en esta page).
 */
export default async function ConversationsPage({ params }: Props) {
  const { placeSlug } = await params
  const place = await loadPlaceBySlug(placeSlug)
  if (!place) notFound()

  const viewer = await resolveViewerForPlace({ placeSlug })

  const { items, nextCursor } = await listPostsByPlace({
    placeId: place.id,
    includeHidden: viewer.isAdmin,
    viewerUserId: viewer.actorId,
  })

  return (
    <PostList
      placeId={place.id}
      items={items}
      nextCursor={
        nextCursor ? { createdAt: nextCursor.createdAt.toISOString(), id: nextCursor.id } : null
      }
    />
  )
}
