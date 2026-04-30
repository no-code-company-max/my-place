import { notFound } from 'next/navigation'
import { loadPlaceBySlug } from '@/shared/lib/place-loader'
import {
  CategoryGrid,
  EmptyLibrary,
  LibrarySectionHeader,
  RecentsList,
  type LibraryCategory,
  type LibraryDoc,
} from '@/features/library/public'

type Props = { params: Promise<{ placeSlug: string }> }

/**
 * Zona raíz de la Biblioteca (R.5 — UI scaffold sin backend).
 *
 * Estructura JSX completa con conditionals para que cuando exista el
 * backend (R.5.X follow-up) solo cambie la fuente de datos —
 * componentes y layout intactos:
 *
 *   const categories = await listLibraryCategories(place.id)
 *   const recents = await listRecentDocs(place.id)
 *
 * Hoy `categories` y `recents` son arrays vacíos hardcoded → el user
 * ve `<EmptyLibrary>` en producción. Decisión user 2026-04-30 (sin
 * stubs de queries; UI pura hasta que el backend exista de verdad).
 *
 * Ver `docs/features/library/spec.md` § 4.
 */
export default async function LibraryPage({ params }: Props) {
  const { placeSlug } = await params
  const place = await loadPlaceBySlug(placeSlug)
  if (!place) notFound()

  const categories: LibraryCategory[] = []
  const recents: LibraryDoc[] = []

  return (
    <section className="flex flex-col gap-4 px-3 py-6">
      <LibrarySectionHeader />
      {categories.length === 0 ? <EmptyLibrary /> : <CategoryGrid categories={categories} />}
      {recents.length > 0 ? <RecentsList docs={recents} /> : null}
    </section>
  )
}
