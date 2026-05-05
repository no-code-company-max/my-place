import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getCurrentAuthUser } from '@/shared/lib/auth-user'
import { loadPlaceBySlug } from '@/shared/lib/place-loader'
import { findMemberPermissions } from '@/features/members/public.server'
import { listGroupsByPlace } from '@/features/groups/public.server'
import { ADMIN_PRESET_NAME, GroupsListAdmin } from '@/features/groups/public'
import { listLibraryCategories } from '@/features/library/public.server'
import { PageHeader } from '@/shared/ui/page-header'

export const metadata: Metadata = {
  title: 'Grupos · Settings',
}

type Props = {
  params: Promise<{ placeSlug: string }>
}

/**
 * Settings de Grupos (G.5) — owner-only listado de grupos de permisos
 * del place.
 *
 * Refactor mayo 2026 (`docs/ux-patterns.md`): la lista pasa de "row densa
 * con todo inline" a "row minimalista (nombre + chip preset + count) +
 * página detalle por grupo en `[groupId]/page.tsx`". El motivo: en mobile
 * (360px) el listado anterior generaba scroll infinito desde 2 grupos —
 * cada row mostraba todos los permisos como chips wrappable + scope en
 * otra fila + 3 botones inline (Editar/Miembros/Eliminar). Ahora cada
 * row navega al detalle.
 *
 * Gate doble:
 *  1. El layout `/settings/layout.tsx` ya gateá owner-OR-cualquier-permiso-
 *     atómico (G.3). Sin él, este page no se renderea.
 *  2. Acá, además, exigimos `isOwner` — gestión de grupos es owner-only
 *     hardcoded (decisión ADR `2026-05-02-permission-groups-model.md`).
 *     Otros miembros con permisos atómicos reciben 404.
 *
 * Carga en paralelo:
 *  - Lista de grupos del place (incluye preset "Administradores" arriba
 *    — ordering en `listGroupsByPlace`). Cada uno trae `memberCount`
 *    precomputado.
 *  - Categorías de library (alimentan el `<CategoryScopeSelector>`
 *    interno del form sheet en modo create cuando un permiso `library:*`
 *    está activo).
 *
 * Ver `docs/features/groups/spec.md` § 5.
 */
export default async function SettingsGroupsPage({ params }: Props) {
  const { placeSlug } = await params

  const auth = await getCurrentAuthUser()
  if (!auth) {
    redirect(`/login?next=/settings/groups`)
  }

  const place = await loadPlaceBySlug(placeSlug)
  if (!place || place.archivedAt) {
    notFound()
  }

  const perms = await findMemberPermissions(auth.id, place.id)
  if (!perms.isOwner) {
    notFound()
  }

  const [groups, categories] = await Promise.all([
    listGroupsByPlace(place.id),
    listLibraryCategories(place.id),
  ])

  const categoryOptions = categories.map((c) => ({
    id: c.id,
    emoji: c.emoji,
    title: c.title,
  }))

  const customGroups = groups.filter((g) => !g.isPreset)
  const hasCustomGroups = customGroups.length > 0

  return (
    <div className="space-y-6 px-3 py-6 md:px-4 md:py-8">
      <PageHeader
        title="Grupos"
        description={
          <>
            Definí grupos con permisos atómicos para delegar moderación. El grupo &quot;
            {ADMIN_PRESET_NAME}&quot; tiene todos los permisos por defecto y no se puede eliminar.
          </>
        }
      />

      <section aria-labelledby="groups-list-heading" className="space-y-3">
        <h2
          id="groups-list-heading"
          className="border-b pb-2 font-serif text-xl"
          style={{ borderColor: 'var(--border)' }}
        >
          Grupos
        </h2>
        <p className="mt-1 text-xs text-neutral-600">
          {groups.length} {groups.length === 1 ? 'grupo' : 'grupos'}. El preset &quot;
          {ADMIN_PRESET_NAME}&quot; tiene todos los permisos por defecto.
        </p>

        <GroupsListAdmin placeSlug={place.slug} groups={groups} categories={categoryOptions} />

        {!hasCustomGroups && (
          <p className="text-sm italic text-neutral-500">
            Todavía no creaste grupos custom. Crealos para delegar moderación a miembros sin darles
            todos los permisos.
          </p>
        )}
      </section>
    </div>
  )
}
