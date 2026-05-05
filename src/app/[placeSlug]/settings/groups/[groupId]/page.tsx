import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getCurrentAuthUser } from '@/shared/lib/auth-user'
import { loadPlaceBySlug } from '@/shared/lib/place-loader'
import { findMemberPermissions, listActiveMembers } from '@/features/members/public.server'
import { GroupDetailView } from '@/features/groups/public'
import { findGroupById, listMembershipsByGroup } from '@/features/groups/public.server'
import { listLibraryCategories } from '@/features/library/public.server'
import { PageHeader } from '@/shared/ui/page-header'

export const metadata: Metadata = {
  title: 'Grupo · Settings',
}

type Props = {
  params: Promise<{ placeSlug: string; groupId: string }>
}

/**
 * Detalle de un grupo de permisos. Owner-only — `/settings/layout.tsx`
 * gateá owner-OR-cualquier-permiso-atómico, este page exige
 * `isOwner` (gestión de grupos es owner-only hardcoded — ADR
 * `2026-05-02-permission-groups-model.md`).
 *
 * El refactor de mayo 2026 movió toda la info densa (permisos + scope +
 * miembros + acciones) acá, dejando `/settings/groups` como lista
 * minimalista de rows enlazadas. Ver `docs/ux-patterns.md` y el spec
 * § 7 "Empty states".
 *
 * Carga en paralelo:
 *  - Grupo por id (404 si no existe o no pertenece al place del slug).
 *  - Miembros del grupo (alimenta la sección "Miembros" + el sheet).
 *  - Categorías de library (alimenta el `<CategoryScopeSelector>`
 *    interno del form sheet cuando un permiso `library:*` está activo).
 *  - Miembros activos del place (alimenta el sheet de gestión de
 *    miembros — owner queda excluido del available pool, mismo guard
 *    server-side en `addMemberToGroupAction`).
 */
export default async function SettingsGroupDetailPage({ params }: Props) {
  const { placeSlug, groupId } = await params

  const auth = await getCurrentAuthUser()
  if (!auth) {
    redirect(`/login?next=/settings/groups/${groupId}`)
  }

  const place = await loadPlaceBySlug(placeSlug)
  if (!place || place.archivedAt) {
    notFound()
  }

  const perms = await findMemberPermissions(auth.id, place.id)
  if (!perms.isOwner) {
    notFound()
  }

  const group = await findGroupById(groupId)
  // Defensa contra group-id que no pertenece al place del slug — un owner
  // del place A no puede ver detalles de un grupo del place B aunque
  // adivine el id.
  if (!group || group.placeId !== place.id) {
    notFound()
  }

  const [members, categories, activeMembers] = await Promise.all([
    listMembershipsByGroup(group.id),
    listLibraryCategories(place.id),
    listActiveMembers(place.id),
  ])

  const categoryOptions = categories.map((c) => ({
    id: c.id,
    emoji: c.emoji,
    title: c.title,
  }))

  const memberIds = new Set(members.map((m) => m.userId))
  // Owner queda excluido del available pool — owner es dios implícito,
  // no se asigna a grupos. Mismo guard server-side en `addMemberToGroupAction`
  // (target_is_owner).
  const availableMembers = activeMembers
    .filter((m) => !m.isOwner && !memberIds.has(m.userId))
    .map((m) => ({
      userId: m.userId,
      displayName: m.user.displayName,
      handle: m.user.handle,
      avatarUrl: m.user.avatarUrl,
    }))

  return (
    <div className="space-y-6 px-3 py-6 md:px-4 md:py-8">
      <Link
        href="/settings/groups"
        className="inline-block text-sm text-neutral-600 hover:text-neutral-900"
      >
        ← Volver a Grupos
      </Link>
      <PageHeader
        title={group.name}
        description={
          group.description ??
          (group.isPreset ? 'Grupo preset auto-generado. No se puede eliminar.' : '')
        }
      />

      <GroupDetailView
        placeSlug={place.slug}
        group={group}
        categories={categoryOptions}
        members={members}
        availableMembers={availableMembers}
      />
    </div>
  )
}
