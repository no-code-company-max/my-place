import { formatAbsoluteTimeLong } from '@/shared/lib/format-date'
import { tierDurationLabel } from '@/features/tiers/public'
import type { TierMembershipDetail } from '@/features/tier-memberships/domain/types'
import { RemoveAssignmentButton } from './remove-assignment-button'

type Props = {
  tierMemberships: ReadonlyArray<TierMembershipDetail>
}

/**
 * Lista de tiers asignados a un miembro. Server Component dentro de
 * `/settings/members/[userId]` (RSC, owner-only).
 *
 * Cada row muestra:
 *  - nombre del tier
 *  - duración como label informativo (no countdown — CLAUDE.md "sin
 *    urgencia artificial")
 *  - "Expira el X" si tiene fecha, "Indefinido" si no
 *  - botón quitar (Client island con confirm inline)
 *
 * Empty state inline cuando el miembro no tiene tiers.
 */
export function AssignedTiersList({ tierMemberships }: Props): React.ReactNode {
  if (tierMemberships.length === 0) {
    return <p className="text-sm text-muted">Este miembro no tiene ningún tier asignado todavía.</p>
  }

  return (
    <ul className="divide-y divide-border rounded-md border border-border">
      {tierMemberships.map((tm) => (
        <li
          key={tm.id}
          className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h4 className="truncate font-title text-sm font-semibold text-text">
                {tm.tier.name}
              </h4>
              <span className="text-xs text-muted">{tierDurationLabel(tm.tier.duration)}</span>
            </div>
            <p className="mt-0.5 text-xs text-muted">
              {tm.expiresAt ? `Expira el ${formatAbsoluteTimeLong(tm.expiresAt)}` : 'Indefinido'}
            </p>
          </div>
          <div className="flex shrink-0">
            <RemoveAssignmentButton tierMembershipId={tm.id} tierName={tm.tier.name} />
          </div>
        </li>
      ))}
    </ul>
  )
}
