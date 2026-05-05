import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getCurrentAuthUser } from '@/shared/lib/auth-user'
import { loadPlaceBySlug } from '@/shared/lib/place-loader'
import { findMemberPermissions } from '@/features/members/public.server'
import { listTiersByPlace } from '@/features/tiers/public.server'
import { TiersListAdmin } from '@/features/tiers/public'
import { PageHeader } from '@/shared/ui/page-header'

export const metadata: Metadata = {
  title: 'Tiers · Settings',
}

type Props = {
  params: Promise<{ placeSlug: string }>
}

/**
 * Settings de Tiers (T.4) — owner-only CRUD de tiers del place.
 *
 * Gate doble:
 *  1. El layout `/settings/layout.tsx` ya gatea admin-or-owner. Sin él,
 *     este page no se renderea.
 *  2. Acá, además, exigimos `isOwner` — el admin puro recibe 404
 *     (decisión #1 ADR: tiers son owner-only, admin no califica).
 *
 * Carga simple: una sola query para listar todos los tiers del place
 * (owner ve PUBLISHED + HIDDEN). Sin N+1 ni stats v1.
 *
 * UI: padding mobile-first (`px-3 py-6 md:px-4 md:py-8`) per ADR
 * `2026-05-03-mobile-first-page-padding.md`. `<PageHeader>` para el
 * título; el orquestador `<TiersListAdmin>` (Client Component) contiene
 * sección + heading + lista (o empty state) + botón "+ Nuevo tier"
 * dashed-border + sheet de form. Mismo patrón que `<CategoryListAdmin>`
 * — el page solo carga datos y se los pasa al panel.
 *
 * Ver `docs/features/tiers/spec.md` § 4 y `docs/ux-patterns.md`.
 */
export default async function SettingsTiersPage({ params }: Props) {
  const { placeSlug } = await params

  const auth = await getCurrentAuthUser()
  if (!auth) {
    redirect(`/login?next=/settings/tiers`)
  }

  const place = await loadPlaceBySlug(placeSlug)
  if (!place || place.archivedAt) {
    notFound()
  }

  const perms = await findMemberPermissions(auth.id, place.id)
  if (!perms.isOwner) {
    notFound()
  }

  const tiers = await listTiersByPlace(place.id, true)

  return (
    <div className="space-y-6 px-3 py-6 md:px-4 md:py-8">
      <PageHeader
        title="Tiers"
        description="Definí los segmentos de membresía del place. Los tiers nuevos arrancan ocultos — publicalos cuando estén listos. v1 sólo gestiona la definición; cobros y asignación a miembros llegan más adelante."
      />

      <TiersListAdmin placeSlug={place.slug} tiers={tiers} />
    </div>
  )
}
