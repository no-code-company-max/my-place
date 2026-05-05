import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getCurrentAuthUser } from '@/shared/lib/auth-user'
import { findPlaceOwnership } from '@/shared/lib/identity-cache'
import { loadPlaceBySlug } from '@/shared/lib/place-loader'
import {
  findMemberBlockInfo,
  findMemberDetailForOwner,
  hasPermission,
} from '@/features/members/public.server'
import { listTiersByPlace } from '@/features/tiers/public.server'
import { listAssignmentsByMember } from '@/features/tier-memberships/public.server'
import { listGroupsByPlace, listGroupsForUser } from '@/features/groups/public.server'
import type { GroupSummary } from '@/features/groups/public'
import { BackButton } from '@/shared/ui/back-button'
import { MemberDetailHeader } from './components/member-detail-header'
import { TiersSection } from './components/tiers-section'
import { GroupsSection } from './components/groups-section'
import { BlockSection } from './components/block-section'
import { ExpelSection } from './components/expel-section'

type Props = {
  params: Promise<{ placeSlug: string; userId: string }>
}

/**
 * Detalle de un miembro del place.
 *
 * Gate del page (defense in depth — `/settings/layout.tsx` ya gateia
 * admin-or-owner):
 *  - Owner → acceso completo.
 *  - Viewer con `members:block` → acceso para usar la sección "Bloquear".
 *  - Otros → 404.
 *
 * Secciones (visibilidad condicional):
 *  - Header: siempre.
 *  - "Tiers asignados" (assign/remove): owner-only.
 *  - "Grupos asignados" (`<MemberGroupsControl>`): owner-only.
 *  - "Bloquear miembro": viewer con `members:block` AND target NO es owner
 *    AND target NO es self. Si ya bloqueado → metadata + dialog "Desbloquear";
 *    si no → dialog "Bloquear".
 *  - "Expulsar miembro": owner AND target NO es owner AND target NO es self.
 *
 * **Modelo de admin**: no hay sección "Rol" en el page. La condición
 * MEMBER↔ADMIN se deriva exclusivamente de la pertenencia al grupo preset
 * "Administradores", que se gestiona desde la sección "Grupos asignados".
 * La columna `Membership.role` fue dropeada en la migration
 * `20260503000100_drop_membership_role`; cualquier check de admin pasa por
 * `is_place_admin` (SQL helper) o el preset group resuelto vía
 * `features/groups`.
 *
 * **Connection-limit gotcha (CLAUDE.md)**: todas las queries del page se
 * disparan en `Promise.all` para no perder paralelización en dev con
 * `connection_limit=1` (relevante sólo si el usuario expone
 * `DEV_DATABASE_URL` con un cap más alto).
 *
 * Spec: docs/features/groups/spec.md § 5.
 * ADR:  docs/decisions/2026-05-02-permission-groups-model.md.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { placeSlug, userId } = await params
  const place = await loadPlaceBySlug(placeSlug)
  if (!place) return { title: 'Miembro · Settings' }
  const member = await findMemberDetailForOwner(userId, place.id)
  if (!member) return { title: 'Miembro · Settings' }
  return { title: `${member.user.displayName} · Miembros · Settings` }
}

export default async function SettingsMemberDetailPage({ params }: Props) {
  const { placeSlug, userId } = await params

  const auth = await getCurrentAuthUser()
  if (!auth) {
    redirect(`/login?next=/settings/members/${userId}`)
  }

  const place = await loadPlaceBySlug(placeSlug)
  if (!place || place.archivedAt) {
    notFound()
  }

  // Gate: owner OR viewer con members:block. Otros → 404 (defense in depth
  // sobre el layout settings que ya gateia admin-or-owner).
  const [viewerCanBlock, viewerIsOwner] = await Promise.all([
    hasPermission(auth.id, place.id, 'members:block'),
    findPlaceOwnership(auth.id, place.id),
  ])
  if (!viewerIsOwner && !viewerCanBlock) {
    notFound()
  }

  // Carga de detalle + datos de las secciones (Promise.all para paralelismo).
  // `listGroupsByPlace` + `listGroupsForUser` se podrían fusionar si la
  // página crece, pero hoy es legible así y son indexadas.
  const [member, allTiers, assignments, allGroups, memberGroups, blockInfo] = await Promise.all([
    findMemberDetailForOwner(userId, place.id),
    listTiersByPlace(place.id, true),
    listAssignmentsByMember(userId, place.id),
    listGroupsByPlace(place.id),
    listGroupsForUser(userId, place.id),
    findMemberBlockInfo(userId, place.id),
  ])
  if (!member) {
    notFound()
  }

  const publishedTiers = allTiers.filter((t) => t.visibility === 'PUBLISHED')

  // Grupos disponibles: los del place a los que el miembro NO pertenece.
  const memberGroupIds = new Set(memberGroups.map((g) => g.id))
  const availableGroups: GroupSummary[] = allGroups
    .filter((g) => !memberGroupIds.has(g.id))
    .map((g) => ({ id: g.id, name: g.name, isPreset: g.isPreset }))

  const isSelf = member.userId === auth.id
  const targetIsOwner = member.isOwner
  const showBlockSection = viewerCanBlock && !targetIsOwner && !isSelf
  const showExpelSection = viewerIsOwner && !targetIsOwner && !isSelf
  const actorEmail = auth.email ?? ''

  return (
    <div className="space-y-6 px-3 py-6 md:px-4 md:py-8">
      <div>
        <BackButton fallbackHref={`/settings/members`} label="Volver al directorio" />
      </div>

      <MemberDetailHeader member={member} />

      {viewerIsOwner ? (
        <>
          <TiersSection
            placeSlug={place.slug}
            memberUserId={member.userId}
            assignments={assignments}
            publishedTiers={publishedTiers}
          />
          <GroupsSection
            placeId={place.id}
            memberUserId={member.userId}
            currentGroups={memberGroups}
            availableGroups={availableGroups}
          />
        </>
      ) : null}

      {showBlockSection ? (
        <BlockSection
          placeId={place.id}
          memberUserId={member.userId}
          memberDisplayName={member.user.displayName}
          actorEmail={actorEmail}
          blockInfo={blockInfo}
        />
      ) : null}

      {showExpelSection ? (
        <ExpelSection
          placeId={place.id}
          memberUserId={member.userId}
          memberDisplayName={member.user.displayName}
          actorEmail={actorEmail}
        />
      ) : null}
    </div>
  )
}
