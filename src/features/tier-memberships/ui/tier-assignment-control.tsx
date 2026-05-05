'use client'

import { useState, useTransition } from 'react'
import { toast } from '@/shared/ui/toaster'
import { tierDurationLabel } from '@/features/tiers/public'
import type { Tier } from '@/features/tiers/public'
import { assignTierToMemberAction } from '@/features/tier-memberships/public'
import { friendlyTierMembershipErrorMessage } from './errors'

type Props = {
  placeSlug: string
  memberUserId: string
  /**
   * Tiers disponibles para asignar. Se filtra a `visibility = PUBLISHED`
   * **server-side** antes de pasar como prop — este componente confía en
   * que la prop ya venga limpia (defense in depth: la action también
   * valida).
   */
  availableTiers: ReadonlyArray<Tier>
}

/**
 * Form de asignación de tier a un miembro. Client island dentro del
 * detalle `/settings/members/[userId]` (RSC, owner-only).
 *
 * - Dropdown de tiers PUBLISHED filtrados server-side.
 * - Checkbox "Indefinido" (default OFF — usa `tier.duration` para calcular
 *   `expiresAt`).
 * - Submit con `useTransition` + pending state.
 * - Toast Sonner por outcome:
 *    * happy → "Tier asignado."
 *    * `tier_not_published` → "Ese tier no está publicado…"
 *    * `tier_already_assigned` → "Este miembro ya tiene este tier asignado."
 *    * `target_user_not_member` → "El miembro ya no está activo…"
 *    * inesperado → mapper genérico.
 */
export function TierAssignmentControl({
  placeSlug,
  memberUserId,
  availableTiers,
}: Props): React.ReactNode {
  const [pending, startTransition] = useTransition()
  const [tierId, setTierId] = useState<string>(availableTiers[0]?.id ?? '')
  const [indefinite, setIndefinite] = useState(false)

  if (availableTiers.length === 0) {
    return (
      <p className="text-sm text-muted">
        No hay tiers publicados. Creá y publicá uno en{' '}
        <a href={`/${placeSlug}/settings/tiers`} className="underline">
          Tiers
        </a>{' '}
        para poder asignarlo.
      </p>
    )
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    if (!tierId) {
      toast.error('Elegí un tier antes de asignar.')
      return
    }

    startTransition(async () => {
      try {
        const result = await assignTierToMemberAction({
          placeSlug,
          memberUserId,
          tierId,
          indefinite,
        })
        if (!result.ok) {
          if (result.error === 'tier_not_published') {
            toast.error('Ese tier no está publicado. Publicalo desde Tiers primero.')
          } else if (result.error === 'tier_already_assigned') {
            toast.error('Este miembro ya tiene este tier asignado.')
          } else if (result.error === 'target_user_not_member') {
            toast.error('El miembro ya no está activo en el place.')
          }
          return
        }
        toast.success('Tier asignado.')
      } catch (err) {
        toast.error(friendlyTierMembershipErrorMessage(err))
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3" noValidate>
      <label className="block">
        <span className="mb-1 block text-sm text-muted">Tier</span>
        <select
          value={tierId}
          onChange={(e) => setTierId(e.target.value)}
          disabled={pending}
          className="w-full rounded-md border border-border bg-bg px-3 py-2 text-text focus:border-text focus:outline-none"
        >
          {availableTiers.map((tier) => (
            <option key={tier.id} value={tier.id}>
              {tier.name} · {tierDurationLabel(tier.duration)}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2 text-sm text-text">
        <input
          type="checkbox"
          checked={indefinite}
          onChange={(e) => setIndefinite(e.target.checked)}
          disabled={pending}
          className="h-4 w-4 rounded border-border"
        />
        <span>Indefinido (sin fecha de expiración)</span>
      </label>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-4 py-2 text-sm text-bg disabled:opacity-60"
        >
          {pending ? 'Asignando…' : 'Asignar tier'}
        </button>
      </div>
    </form>
  )
}
