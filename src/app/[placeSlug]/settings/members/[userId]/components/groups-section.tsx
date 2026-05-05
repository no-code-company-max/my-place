import { MemberGroupsControl, type GroupSummary } from '@/features/groups/public'

type Props = {
  placeId: string
  memberUserId: string
  /** Grupos a los que el miembro YA pertenece (incluye preset). */
  currentGroups: ReadonlyArray<GroupSummary>
  /** Grupos del place a los que el miembro NO pertenece todavía. */
  availableGroups: ReadonlyArray<GroupSummary>
}

/**
 * Sección "Grupos asignados" del detalle (G.6).
 *
 * Owner-only — el page padre decide cuándo renderear. Compone el Client
 * island `<MemberGroupsControl>` que dispara las server actions del slice
 * `groups/`.
 *
 * Spec: docs/features/groups/spec.md § 5.
 */
export function GroupsSection({
  placeId,
  memberUserId,
  currentGroups,
  availableGroups,
}: Props): React.ReactNode {
  return (
    <section className="space-y-3">
      <h2 className="font-title text-base font-semibold text-text">Grupos asignados</h2>
      <MemberGroupsControl
        placeId={placeId}
        memberUserId={memberUserId}
        currentGroups={currentGroups}
        availableGroups={availableGroups}
      />
    </section>
  )
}
