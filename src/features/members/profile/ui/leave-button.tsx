'use client'

import { useState, useTransition } from 'react'
import { toast } from '@/shared/ui/toaster'
import { leaveMembershipAction } from '../server/actions/leave'
import { isDomainError } from '@/shared/errors/domain-error'

/**
 * Botón de "salir del place" — patrón destructive canónico (collapsed → confirmed
 * pair). Click abre el confirm inline; segundo click ejecuta la acción.
 *
 * Tras salir, navega al dashboard universal (`appUrl`), que vive en el apex — no tiene
 * sentido volver al place del que el user acaba de salir porque el middleware lo va a
 * rebotar (ya no es miembro).
 */
export function LeaveButton({ placeSlug, appUrl }: { placeSlug: string; appUrl: string }) {
  const [pending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)

  function leave() {
    startTransition(async () => {
      try {
        await leaveMembershipAction(placeSlug)
        window.location.href = `${appUrl}/inbox`
      } catch (err) {
        setConfirming(false)
        toast.error(friendlyMessage(err))
      }
    })
  }

  if (confirming) {
    return (
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={pending}
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-md border border-neutral-300 px-4 text-sm disabled:opacity-60"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={leave}
          disabled={pending}
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-md border border-red-600 bg-red-600 px-4 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? 'Saliendo…' : 'Sí, salir'}
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      disabled={pending}
      className="inline-flex min-h-11 w-full items-center justify-center rounded-md px-4 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
    >
      Salir de este place
    </button>
  )
}

function friendlyMessage(err: unknown): string {
  if (isDomainError(err)) {
    switch (err.code) {
      case 'VALIDATION':
        return err.message
      case 'AUTHORIZATION':
        return 'Tu sesión expiró. Iniciá sesión de nuevo.'
      case 'NOT_FOUND':
        return 'Ya no sos miembro de este place.'
      case 'INVARIANT_VIOLATION':
        return err.message
      case 'CONFLICT':
        return err.message
      default:
        return 'No se pudo salir del place.'
    }
  }
  return 'Error inesperado. Intentá de nuevo.'
}
