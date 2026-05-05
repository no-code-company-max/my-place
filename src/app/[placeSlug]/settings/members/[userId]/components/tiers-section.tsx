import {
  AssignedTiersList,
  TierAssignmentControl,
  type TierMembershipDetail,
} from '@/features/tier-memberships/public'
import type { Tier } from '@/features/tiers/public'

type Props = {
  placeSlug: string
  memberUserId: string
  /** Tier-memberships activas del miembro en este place (con tier joined). */
  assignments: TierMembershipDetail[]
  /** Tiers `PUBLISHED` del place que el control puede asignar. */
  publishedTiers: Tier[]
}

/**
 * Sección "Tiers asignados" del detalle (G.6 — extracción del page).
 *
 * Owner-only — el page padre decide cuándo renderear. Compone
 * `<AssignedTiersList>` (read) + `<TierAssignmentControl>` (write).
 *
 * Spec: docs/features/tier-memberships/spec.md § 4.
 */
export function TiersSection({
  placeSlug,
  memberUserId,
  assignments,
  publishedTiers,
}: Props): React.ReactNode {
  return (
    <section className="space-y-3">
      <h2 className="font-title text-base font-semibold text-text">Tiers asignados</h2>
      <AssignedTiersList tierMemberships={assignments} />
      <div className="rounded-md border border-dashed border-border p-4">
        <h3 className="mb-3 font-title text-sm font-semibold text-text">Asignar tier</h3>
        <TierAssignmentControl
          placeSlug={placeSlug}
          memberUserId={memberUserId}
          availableTiers={publishedTiers}
        />
      </div>
    </section>
  )
}
