import { notFound } from 'next/navigation'
import { loadPlaceBySlug } from '@/shared/lib/place-loader'
import { CategoryHeaderBar, EmptyItemList, ItemList } from '@/features/library/public'
import {
  findLibraryCategoryBySlug,
  listItemsByCategory,
  resolveLibraryViewer,
} from '@/features/library/public.server'
import { canWriteCategory } from '@/features/library/contribution/public'
import { findWriteScope } from '@/features/library/contribution/public.server'
import { CourseItemList } from '@/features/library/courses/public'
import {
  listCategoryItemsForPrereqLookup,
  listCompletedItemIdsByUser,
} from '@/features/library/courses/public.server'

type Props = {
  params: Promise<{ placeSlug: string; categorySlug: string }>
}

/**
 * Sub-page de categoría (R.7.10 — backend conectado).
 *
 * Resuelve la categoría, lista sus items, evalúa permisos del viewer
 * para decidir si renderiza el botón "Nuevo" + el CTA del empty state.
 *
 * Categorías archivadas: 404 para members, visibles para admin (la
 * RLS de SELECT ya enforce esto, acá adicional `notFound()` defensivo
 * para members con archivedAt poblado).
 *
 * **Courses (W4 wiring 2026-05-14)**: si `category.kind === 'COURSE'`,
 * renderea `<CourseItemList>` (lock-aware) en vez de `<ItemList>` plana.
 * Carga `completedItemIds` del viewer + `itemsLookup` (Map id → meta) para
 * que items con prereq incompleto rendean como `<LibraryItemLockedRow>`.
 * Owner bypass: ve todos los items desbloqueados (admin necesita el
 * "itinerary map" completo). Categorías GENERAL siguen con `<ItemList>` plana.
 *
 * Ver `docs/features/library/spec.md` § 4 + § 6 + ADR
 * `docs/decisions/2026-05-04-library-courses-and-read-access.md` D2.
 */
export default async function LibraryCategoryPage({ params }: Props) {
  const { placeSlug, categorySlug } = await params

  const place = await loadPlaceBySlug(placeSlug)
  if (!place) notFound()

  const { viewer, actor } = await resolveLibraryViewer({ placeSlug })
  const category = await findLibraryCategoryBySlug(place.id, categorySlug, {
    includeArchived: viewer.isAdmin,
  })
  if (!category) notFound()
  if (category.archivedAt && !viewer.isAdmin) notFound()

  const writeScope = await findWriteScope(category.id)
  const canCreate = writeScope
    ? canWriteCategory(
        {
          writeAccessKind: writeScope.kind,
          groupWriteIds: writeScope.groupIds,
          tierWriteIds: writeScope.tierIds,
          userWriteIds: writeScope.userIds,
        },
        viewer,
      )
    : false

  const items = await listItemsByCategory(category.id)
  const isCourse = category.kind === 'COURSE'

  // Solo cargar courses data cuando la categoría es CURSO. Para GENERAL
  // serían queries innecesarias (la lista usa <ItemList> plana sin lock).
  const completedItemIds = isCourse ? await listCompletedItemIdsByUser(actor.actorId, place.id) : []
  // itemsLookup: Map id → { title, categorySlug, postSlug }. Usado por
  // <CourseItemList> para resolver el prereq de cada item bloqueado y
  // construir el toast CTA "Ir a [prereq]".
  const itemsLookup = new Map<string, { title: string; categorySlug: string; postSlug: string }>()
  if (isCourse) {
    const lookupRows = await listCategoryItemsForPrereqLookup(category.id, place.id)
    for (const row of lookupRows) {
      itemsLookup.set(row.id, {
        title: row.title,
        categorySlug: category.slug,
        postSlug: row.postSlug,
      })
    }
  }

  return (
    <div className="pb-6">
      <CategoryHeaderBar />
      <header className="mt-4 px-3">
        <h1 className="font-title text-[28px] font-bold text-text">
          {category.emoji} {category.title}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {items.length === 0
            ? 'Sin recursos todavía'
            : items.length === 1
              ? '1 recurso'
              : `${items.length} recursos`}
          {category.archivedAt ? ' · archivada' : ''}
          {isCourse ? ' · curso' : ''}
        </p>
      </header>

      <div className="mt-4">
        {items.length === 0 ? (
          <EmptyItemList canCreate={canCreate} categorySlug={category.slug} />
        ) : isCourse ? (
          <CourseItemList
            items={items}
            completedItemIds={completedItemIds}
            itemsLookup={itemsLookup}
            viewerIsOwner={viewer.isOwner}
          />
        ) : (
          <ItemList items={items} />
        )}
      </div>
    </div>
  )
}
