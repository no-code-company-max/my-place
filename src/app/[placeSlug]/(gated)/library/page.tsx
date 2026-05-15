import { notFound } from 'next/navigation'
import { loadPlaceBySlug } from '@/shared/lib/place-loader'
import { resolveViewerForPlace } from '@/features/discussions/public.server'
import {
  CategoryGrid,
  EmptyLibrary,
  LibrarySectionHeader,
  RecentsList,
} from '@/features/library/public'
import { listLibraryCategories, listRecentItems } from '@/features/library/public.server'
import { listLibraryCategoriesForMentionAction } from '@/features/library/public'

type Props = { params: Promise<{ placeSlug: string }> }

/**
 * Zona raíz de la Biblioteca (R.7.10 — backend conectado).
 *
 * Estructura JSX intacta vs R.5: solo cambia la fuente de datos. Carga
 * en paralelo: viewer + categorías activas + items recientes.
 *
 * Renderiza:
 *   - LibrarySectionHeader (siempre).
 *   - CategoryGrid si hay categorías; si no, EmptyLibrary (con CTA
 *     condicional para admin → /settings/library).
 *   - RecentsList si hay items recientes (top-5).
 *
 * Ver `docs/features/library/spec.md` § 4 + § 6.
 */
export default async function LibraryPage({ params }: Props) {
  const { placeSlug } = await params
  const place = await loadPlaceBySlug(placeSlug)
  if (!place) notFound()

  const [viewer, categories, recents, readableCats] = await Promise.all([
    resolveViewerForPlace({ placeSlug }),
    listLibraryCategories(place.id),
    listRecentItems(place.id, { limit: 5 }),
    listLibraryCategoriesForMentionAction(place.id),
  ])

  // Hallazgo #2 (Plan A S3): los recents son cross-categoría. Filtramos
  // los de categorías no legibles para el viewer reusando el filtrado
  // ya hecho en `listLibraryCategoriesForMentionAction` (devuelve solo
  // categorías visibles — read-scope o write-scope). `LibraryItemListView`
  // no expone `categoryId`, así que matcheamos por `categorySlug`.
  const readableSlugs = new Set(readableCats.map((c) => c.slug))
  const visibleRecents = recents.filter((r) => readableSlugs.has(r.categorySlug))

  return (
    <section className="flex flex-col gap-4 px-3 py-6">
      <LibrarySectionHeader />
      {categories.length === 0 ? (
        <EmptyLibrary canManageCategories={viewer.isAdmin} />
      ) : (
        <CategoryGrid categories={categories} />
      )}
      {visibleRecents.length > 0 ? <RecentsList items={visibleRecents} /> : null}
    </section>
  )
}
