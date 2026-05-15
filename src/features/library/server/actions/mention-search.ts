'use server'

import { resolveLibraryViewer } from '@/features/library/public.server'
import { canViewCategory } from '@/features/library/access/public.server'
import { listCategoriesForMention, searchLibraryItems } from '../mention-search'

/**
 * Server Action wrappers de las queries cacheadas para autocomplete
 * `/library` two-step en composers. Ver patrón en
 * `members/server/actions/mention-search.ts`.
 *
 * Hallazgo #2 (Plan A S3): las queries internas están cacheadas por
 * `placeId` (sin viewer) — el filtrado por read-access NO puede vivir
 * adentro de la cache (la key no incluye al viewer). Se resuelve acá,
 * post-cache, con el viewer del request: categorías/items de categorías
 * restringidas no aparecen en el autocomplete para quien no tiene
 * acceso (read-scope o write-scope — write implica read).
 */

export async function listLibraryCategoriesForMentionAction(
  placeId: string,
): Promise<Array<{ categoryId: string; slug: string; name: string }>> {
  const [cats, { viewer }] = await Promise.all([
    listCategoriesForMention(placeId),
    resolveLibraryViewer({ placeId }),
  ])
  const visibility = await Promise.all(cats.map((c) => canViewCategory(c.categoryId, viewer)))
  return cats.filter((_, i) => visibility[i])
}

export async function searchLibraryItemsForMentionAction(
  placeId: string,
  categorySlug: string,
  q: string,
): Promise<Array<{ itemId: string; slug: string; title: string }>> {
  const [cats, { viewer }] = await Promise.all([
    listCategoriesForMention(placeId),
    resolveLibraryViewer({ placeId }),
  ])
  const category = cats.find((c) => c.slug === categorySlug)
  if (!category) return []
  if (!(await canViewCategory(category.categoryId, viewer))) return []
  return searchLibraryItems(placeId, categorySlug, q)
}
