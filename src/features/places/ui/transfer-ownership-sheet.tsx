'use client'

import { useEffect, useState, useTransition } from 'react'
import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetClose,
  BottomSheetContent,
  BottomSheetDescription,
  BottomSheetFooter,
  BottomSheetHeader,
  BottomSheetTitle,
} from '@/shared/ui/bottom-sheet'
import { toast } from '@/shared/ui/toaster'
import { isDomainError } from '@/shared/errors/domain-error'
import { transferOwnershipAction } from '../server/actions'

/**
 * BottomSheet para transferir ownership del place a otro miembro activo.
 * Form inlineado siguiendo el patrón canónico de UX (`category-form-sheet`):
 * inputs en `BottomSheetBody`, submit + cancel en `BottomSheetFooter` sticky.
 *
 * `removeActor=true` cede también la membership del actor (sale del place).
 * Default `false` deja una co-ownership con el target.
 *
 * Componente controlled: el padre (`<OwnersAccessPanel>`) maneja `open` +
 * `onOpenChange`; al éxito del submit el sheet se cierra (o el page redirige
 * en el caso `removeActor`). Sin candidatos posibles, muestra empty state.
 */

type Candidate = {
  userId: string
  displayName: string
  handle: string | null
}

type Props = {
  open: boolean
  onOpenChange: (next: boolean) => void
  placeSlug: string
  candidates: Candidate[]
}

export function TransferOwnershipSheet({
  open,
  onOpenChange,
  placeSlug,
  candidates,
}: Props): React.ReactNode {
  const [pending, startTransition] = useTransition()
  const [toUserId, setToUserId] = useState(candidates[0]?.userId ?? '')
  const [removeActor, setRemoveActor] = useState(false)

  // Reset state on open: el `toUserId` puede haber quedado stale si el
  // padre re-renderea con candidates distintas entre aperturas.
  useEffect(() => {
    if (open) {
      setToUserId(candidates[0]?.userId ?? '')
      setRemoveActor(false)
    }
  }, [open, candidates])

  function onSubmit(e: React.FormEvent): void {
    e.preventDefault()
    if (!toUserId) {
      toast.error('Elegí un miembro.')
      return
    }
    startTransition(async () => {
      try {
        await transferOwnershipAction({ placeSlug, toUserId, removeActor })
        if (removeActor) {
          // El actor salió — ya no es miembro, el middleware va a rebotar
          // si se queda. Redirigir al apex.
          window.location.href = '/'
        } else {
          toast.success('Ownership transferida.')
          onOpenChange(false)
        }
      } catch (err) {
        toast.error(friendlyMessage(err))
      }
    })
  }

  const noCandidates = candidates.length === 0

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent aria-describedby={undefined}>
        <BottomSheetHeader>
          <BottomSheetTitle>Transferir ownership</BottomSheetTitle>
          <BottomSheetDescription>
            El nuevo owner tiene que ser miembro activo. Si tildás la opción de salir, perdés acceso
            al place en el mismo paso.
          </BottomSheetDescription>
        </BottomSheetHeader>

        <form onSubmit={onSubmit} noValidate>
          <BottomSheetBody>
            <div className="space-y-4 py-2">
              {noCandidates ? (
                <p className="text-sm italic text-neutral-500">
                  No hay otros miembros a quienes transferir. Invitá a alguien primero.
                </p>
              ) : (
                <>
                  <label className="block">
                    <span className="mb-1 block text-sm text-neutral-600">Transferir a</span>
                    <select
                      value={toUserId}
                      onChange={(e) => setToUserId(e.target.value)}
                      className="block min-h-[44px] w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-base focus:border-neutral-500 focus:outline-none"
                    >
                      {candidates.map((c) => (
                        <option key={c.userId} value={c.userId}>
                          {c.displayName}
                          {c.handle ? ` (@${c.handle})` : ''}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex min-h-11 items-start gap-2 text-sm text-neutral-600">
                    <input
                      type="checkbox"
                      className="mt-1.5"
                      checked={removeActor}
                      onChange={(e) => setRemoveActor(e.target.checked)}
                    />
                    <span>
                      Dejar de ser owner y salir del place. Si lo dejás sin tildar, vas a compartir
                      ownership.
                    </span>
                  </label>
                </>
              )}
            </div>
          </BottomSheetBody>

          <BottomSheetFooter>
            <button
              type="submit"
              disabled={pending || noCandidates}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-md bg-neutral-900 px-4 text-sm font-medium text-white disabled:opacity-60"
            >
              {pending ? 'Transfiriendo…' : 'Transferir ownership'}
            </button>
            <BottomSheetClose asChild>
              <button
                type="button"
                disabled={pending}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-neutral-300 px-4 text-sm disabled:opacity-60"
              >
                Cancelar
              </button>
            </BottomSheetClose>
          </BottomSheetFooter>
        </form>
      </BottomSheetContent>
    </BottomSheet>
  )
}

function friendlyMessage(err: unknown): string {
  if (isDomainError(err)) {
    switch (err.code) {
      case 'VALIDATION':
        return err.message
      case 'AUTHORIZATION':
        return 'Sólo un owner puede transferir ownership.'
      case 'NOT_FOUND':
        return 'No encontramos este place.'
      case 'INVARIANT_VIOLATION':
        return err.message
      case 'CONFLICT':
        return err.message
      default:
        return 'No se pudo transferir la ownership.'
    }
  }
  return 'Error inesperado. Intentá de nuevo.'
}
