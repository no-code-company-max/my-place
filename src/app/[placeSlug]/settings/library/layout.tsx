import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { loadPlaceBySlug } from '@/shared/lib/place-loader'
import {
  CategoryListAdmin,
  MAX_CATEGORIES_PER_PLACE,
  NewCategoryTrigger,
} from '@/features/library/public'
import { listLibraryCategories } from '@/features/library/public.server'
import { listGroupsByPlace } from '@/features/groups/public.server'
import { listActiveMembers } from '@/features/members/public.server'
import { listTiersByPlace } from '@/features/tiers/public.server'
import { PageHeader } from '@/shared/ui/page-header'
import { MasterDetailLayout } from '@/shared/ui/master-detail-layout'

type Props = {
  children: React.ReactNode
  params: Promise<{ placeSlug: string }>
}

/**
 * Layout master-detail de `/settings/library/*`.
 *
 * Aplica el patrón canónico documentado en `docs/ux-patterns.md` § "Master-detail
 * layout" — mismo approach que `/settings/groups`:
 *
 *  - **Master pane (lista)** vive ACÁ, server-rendered una vez. Persiste
 *    al navegar entre `/settings/library` y `/settings/library/[categoryId]`.
 *  - **Detail pane (`{children}`)**:
 *     - `/settings/library` → `page.tsx` (placeholder "Elegí una categoría").
 *     - `/settings/library/[categoryId]` → `[categoryId]/page.tsx` (detail).
 *  - **Mobile**: `<MasterDetailLayout hasDetail>` esconde el master cuando
 *    hay detail (full-screen).
 *  - **Desktop**: split view (master 360px + detail).
 *
 * **S1b cleanup (2026-05-13):** se eliminó el listado de contributors
 * legacy (model viejo `LibraryCategoryContributor` reemplazado por
 * `WriteAccessKind` + 3 pivots write). El trigger "+ Nueva categoría"
 * ahora usa el wizard `CategoryFormSheet` vía `<NewCategoryTrigger>`.
 * Los catalogs (groups/members/tiers) se cargan acá para alimentar el
 * wizard.
 *
 * **S3 pendiente:** revertir master-detail a EditPanel + lista plana
 * (consistente con `/settings/hours` y `/settings/access`).
 */
export default async function LibraryMasterDetailLayout({
  children,
  params,
}: Props): Promise<React.ReactNode> {
  const { placeSlug } = await params

  const place = await loadPlaceBySlug(placeSlug)
  if (!place || place.archivedAt) {
    notFound()
  }

  const [categories, groups, members, tiers] = await Promise.all([
    listLibraryCategories(place.id),
    listGroupsByPlace(place.id),
    listActiveMembers(place.id),
    listTiersByPlace(place.id, true),
  ])

  const groupOptions = groups.map((g) => ({
    id: g.id,
    name: g.name,
    isPreset: g.isPreset,
  }))
  const memberOptions = members.map((m) => ({
    userId: m.userId,
    displayName: m.user.displayName,
    handle: m.user.handle,
  }))
  const tierOptions = tiers.map((t) => ({ id: t.id, name: t.name }))

  const remaining = MAX_CATEGORIES_PER_PLACE - categories.length
  const canCreateMore = remaining > 0

  // hasDetail derivado del pathname: si tenemos /settings/library/<id> y
  // ese id no está vacío, mobile esconde la lista. Desktop muestra ambos.
  const headerStore = await headers()
  const pathname = headerStore.get('x-pathname') ?? ''
  const hasDetail = /^\/settings\/library\/[^/]+/.test(pathname)

  const masterPane = (
    <div className="space-y-6 px-3 py-6 md:px-4 md:py-8">
      <PageHeader
        title="Biblioteca"
        description="Las categorías agrupan los recursos de la biblioteca. Definí emoji, título y quién puede leer/escribir contenido."
      />

      <section aria-labelledby="library-categories-heading" className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2
            id="library-categories-heading"
            className="flex-1 border-b pb-2 font-serif text-xl"
            style={{ borderColor: 'var(--border)' }}
          >
            Categorías
          </h2>
          <span className="text-xs text-neutral-600">
            {categories.length}
            {canCreateMore ? ` de ${MAX_CATEGORIES_PER_PLACE}` : ' — máximo'}
          </span>
        </div>

        <CategoryListAdmin categories={categories} />

        {canCreateMore ? (
          <NewCategoryTrigger
            placeId={place.id}
            groups={groupOptions}
            members={memberOptions}
            tiers={tierOptions}
          />
        ) : (
          <p className="text-xs italic text-neutral-500">
            Llegaste al máximo de {MAX_CATEGORIES_PER_PLACE} categorías. Archivá alguna para crear
            otra.
          </p>
        )}
      </section>
    </div>
  )

  return (
    <MasterDetailLayout
      master={masterPane}
      detail={children}
      hasDetail={hasDetail}
      masterLabel="Lista de categorías"
      detailLabel="Detalle de la categoría"
    />
  )
}
