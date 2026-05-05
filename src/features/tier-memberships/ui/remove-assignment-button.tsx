'use client'

import { useState, useTransition } from 'react'
import { toast } from '@/shared/ui/toaster'
import { removeTierAssignmentAction } from '@/features/tier-memberships/public'
import { friendlyTierMembershipErrorMessage } from './errors'

type Props = {
  tierMembershipId: string
  /**
   * Nombre del tier — se muestra en la confirmación inline para que el
   * owner sepa exactamente qué está removiendo.
   */
  tierName: string
}

/**
 * Botón "Quitar" sobre una asignación de tier. Client island dentro de
 * `<AssignedTiersList>` (RSC, owner-only).
 *
 * Patrón de confirmación inline (mismo de `<EditWindowConfirmDelete>` en
 * `discussions/`): primer click → expande con "¿Seguro? · Sí, quitar /
 * Cancelar". Sin `window.confirm` — UX nativo es feo y no respeta el
 * estilo del place.
 *
 * Toast por outcome:
 *  - happy → "Asignación removida."
 *  - `assignment_not_found` → "La asignación ya estaba removida."
 *  - inesperado → mapper genérico.
 */
export function RemoveAssignmentButton({ tierMembershipId, tierName }: Props): React.ReactNode {
  const [pending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)

  function handleConfirm(): void {
    startTransition(async () => {
      try {
        const result = await removeTierAssignmentAction({ tierMembershipId })
        if (!result.ok) {
          if (result.error === 'assignment_not_found') {
            toast.message('La asignación ya estaba removida.')
          }
          setConfirming(false)
          return
        }
        toast.success('Asignación removida.')
        setConfirming(false)
      } catch (err) {
        toast.error(friendlyTierMembershipErrorMessage(err))
      }
    })
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-md border border-border px-2.5 py-1.5 text-xs text-muted hover:text-text"
        aria-label={`Quitar tier ${tierName}`}
      >
        Quitar
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">
      <span>¿Quitar “{tierName}”?</span>
      <button
        type="button"
        disabled={pending}
        onClick={handleConfirm}
        className="rounded-md bg-amber-700 px-2 py-0.5 text-white disabled:opacity-60"
      >
        {pending ? 'Quitando…' : 'Sí, quitar'}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => setConfirming(false)}
        className="rounded-md px-2 py-0.5 text-amber-900"
      >
        Cancelar
      </button>
    </div>
  )
}
