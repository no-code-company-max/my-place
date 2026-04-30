import { notFound } from 'next/navigation'

/**
 * Sub-page de categoría (R.5 — sin backend).
 *
 * Hoy llama `notFound()` directo: sin tabla `LibraryCategory`, ningún
 * `categorySlug` puede resolverse a una categoría real. Next devuelve
 * 404 standard si el user navega a `/library/cualquier-cosa`.
 *
 * Cuando R.5.X sume backend, este page pasará a:
 *
 *   const place = await loadPlaceBySlug(placeSlug)
 *   const category = await findCategoryBySlug(place.id, categorySlug)
 *   if (!category) notFound()
 *   const docs = await listCategoryDocs(category.id)
 *   const filter = parseTypeFilter(searchParams.get('type'))
 *   ...
 *   return (
 *     <div className="pb-6">
 *       <CategoryHeaderBar />
 *       <header className="mt-4 px-3">…</header>
 *       <TypeFilterPills available={availableTypes} />
 *       {filteredDocs.length === 0 ? <EmptyDocList … /> : <DocList … />}
 *     </div>
 *   )
 *
 * Los componentes ya están scaffolded en `@/features/library/public`.
 *
 * Ver `docs/features/library/spec.md` § 4 + § 9 (R.5.X follow-ups).
 */
export default async function LibraryCategoryPage(): Promise<never> {
  notFound()
}
