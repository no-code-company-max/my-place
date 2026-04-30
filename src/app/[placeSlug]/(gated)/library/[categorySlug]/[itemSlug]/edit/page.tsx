import { notFound } from 'next/navigation'
import { loadPlaceBySlug } from '@/shared/lib/place-loader'
import { resolveViewerForPlace } from '@/features/discussions/public.server'
import { LibraryItemForm, canEditItem } from '@/features/library/public'
import { findItemBySlug } from '@/features/library/public.server'

type Props = {
  params: Promise<{ placeSlug: string; categorySlug: string; itemSlug: string }>
}

/**
 * Edit page del item (R.7.9). Gate: viewer es admin/owner del place
 * o author del item. Si falla → notFound().
 *
 * Reusa `<LibraryItemForm mode="edit">` con los valores actuales del
 * item. El submit redirect a la URL canónica de detail.
 */
export default async function EditLibraryItemPage({ params }: Props) {
  const { placeSlug, categorySlug, itemSlug } = await params

  const place = await loadPlaceBySlug(placeSlug)
  if (!place) notFound()

  const [item, viewer] = await Promise.all([
    findItemBySlug(place.id, categorySlug, itemSlug, { includeArchived: true }),
    resolveViewerForPlace({ placeSlug }),
  ])
  if (!item) notFound()

  const canEdit = canEditItem(
    { authorUserId: item.authorUserId },
    { userId: viewer.actorId, isAdmin: viewer.isAdmin },
  )
  if (!canEdit) notFound()

  return (
    <div className="px-3 py-6">
      <header className="mb-5 flex items-center gap-3">
        <span aria-hidden className="text-3xl leading-none">
          {item.categoryEmoji}
        </span>
        <div>
          <p className="text-sm text-muted">Biblioteca · {item.categoryTitle}</p>
          <h1 className="font-title text-[26px] font-bold tracking-[-0.6px] text-text">
            Editar recurso
          </h1>
        </div>
      </header>

      <LibraryItemForm
        mode={{
          kind: 'edit',
          itemId: item.id,
          categorySlug: item.categorySlug,
          initialTitle: item.title,
          initialBody: item.body as { type: 'doc'; content?: unknown[] } | null,
          initialCoverUrl: item.coverUrl,
        }}
      />
    </div>
  )
}
