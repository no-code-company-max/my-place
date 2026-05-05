'use client'

import { useTransition } from 'react'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/shared/ui/dialog'
import { toast } from '@/shared/ui/toaster'
import { isDomainError } from '@/shared/errors/domain-error'
import { leaveMembershipAction } from '../server/actions/leave'

/**
 * Dialog modal para confirmar la salida del place. Reemplaza el viejo
 * `<LeaveButton>` (que usaba pattern collapsed-confirm-pair inline) por un
 * modal centrado — alinea con la decisión de UX del 2026-05-03 ("Transferir
 * ownership y Salir del place deberian ser modals al hacer click").
 *
 * Es `<Dialog>` y NO `<BottomSheet>` por la misma razón que
 * `archive-category-confirm`: confirms destructivos (1 sola pregunta sí/no)
 * benefician del foco que da el modal centrado; los sheets son para forms
 * con múltiples inputs.
 *
 * Tras salir, navega al dashboard universal (`appUrl`) en el apex — no
 * tiene sentido volver al place del que el user acaba de salir porque el
 * middleware lo va a rebotar (ya no es miembro).
 *
 * Componente controlado: el trigger vive afuera (en `<OwnersAccessPanel>`);
 * acá sólo va el confirm.
 */

type Props = {
  open: boolean
  onOpenChange: (next: boolean) => void
  placeSlug: string
  appUrl: string
}

export function LeavePlaceDialog({
  open,
  onOpenChange,
  placeSlug,
  appUrl,
}: Props): React.ReactNode {
  const [pending, startTransition] = useTransition()

  function handleConfirm(): void {
    startTransition(async () => {
      try {
        await leaveMembershipAction(placeSlug)
        window.location.href = `${appUrl}/inbox`
      } catch (err) {
        toast.error(friendlyMessage(err))
        onOpenChange(false)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Salir de este place</DialogTitle>
        <DialogDescription>
          Tu acceso se cierra y tu contenido queda atribuido 365 días antes de anonimizarse. Si sos
          el único owner, tenés que transferir ownership primero.
        </DialogDescription>

        <div className="mt-5 flex justify-end gap-2">
          <DialogClose asChild>
            <button
              type="button"
              disabled={pending}
              className="inline-flex min-h-11 items-center rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:opacity-60"
            >
              Cancelar
            </button>
          </DialogClose>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={pending}
            className="inline-flex min-h-11 items-center rounded-md border border-red-600 bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {pending ? 'Saliendo…' : 'Sí, salir'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
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
