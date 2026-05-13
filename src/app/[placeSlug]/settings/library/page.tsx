import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { loadPlaceBySlug } from '@/shared/lib/place-loader'
import { listLibraryCategories } from '@/features/library/public.server'
import { listCategoryScopesByPlace } from '@/features/library/contribution/public.server'
import { LibraryCategoriesPanel } from '@/features/library/public'
import { listGroupsByPlace } from '@/features/groups/public.server'
import { listActiveMembers } from '@/features/members/public.server'
import { listTiersByPlace } from '@/features/tiers/public.server'
import { PageHeader } from '@/shared/ui/page-header'

export const metadata: Metadata = {
  title: 'Biblioteca · Settings',
}

type Props = { params: Promise<{ placeSlug: string }> }

/**
 * Admin de categorías de biblioteca (S3, 2026-05-13).
 *
 * **Patrón canónico EditPanel + lista plana** — consistente con
 * `/settings/access` y `/settings/hours`. Reemplaza al master-detail
 * de S3.1.
 *
 * Estructura:
 *  - PageHeader (título + descripción).
 *  - Section "Categorías" con lista plana + "+ Nueva categoría" dashed-border.
 *  - Cada row: emoji + título + chips de acceso (escritura + lectura) +
 *    RowActions (Editar pencil + Archivar trash destructive).
 *  - Editar abre el wizard 4-step (Identidad → Escritura → Lectura →
 *    Tipo) con prefill desde el batch de scopes precargado.
 *  - Archivar confirma via RowActions destructive dialog.
 *
 * Gate admin/owner heredado del layout padre `/settings/layout.tsx` —
 * no re-validamos acá.
 *
 * Data loading: 5 queries en paralelo (categories + scopes batch + groups
 * + members + tiers). El batch de scopes pre-popula todos los write +
 * read scopes en 1 round-trip al pooler para que la edición sea instant
 * sin extra fetches.
 */
export default async function SettingsLibraryPage({ params }: Props) {
  const { placeSlug } = await params

  const place = await loadPlaceBySlug(placeSlug)
  if (!place || place.archivedAt) {
    notFound()
  }

  const [categories, scopesByCategoryId, groups, members, tiers] = await Promise.all([
    listLibraryCategories(place.id),
    listCategoryScopesByPlace(place.id),
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

  return (
    <div className="mx-auto max-w-screen-md space-y-6 px-3 py-6 md:px-4 md:py-8">
      <PageHeader
        title="Biblioteca"
        description="Las categorías agrupan los recursos de la biblioteca. Definí emoji, título y quién puede leer/escribir contenido."
      />

      <LibraryCategoriesPanel
        placeId={place.id}
        categories={categories}
        scopesByCategoryId={scopesByCategoryId}
        groups={groupOptions}
        members={memberOptions}
        tiers={tierOptions}
      />
    </div>
  )
}
