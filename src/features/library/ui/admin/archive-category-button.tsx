'use client'

import { useState, useTransition } from 'react'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/shared/ui/dialog'
import { toast } from '@/shared/ui/toaster'
import { archiveLibraryCategoryAction } from '@/features/library/public'
import { friendlyLibraryErrorMessage } from './errors'

type Props = {
  categoryId: string
  categoryTitle: string
}

/**
 * Botón "Archivar" con confirm dialog. Archivar es soft-delete
 * (la categoría no se destruye — sus items quedan vivos cuando
 * R.7.6 los sume) pero sí desaparece del listado de members. El
 * confirm evita archivar por accidente.
 *
 * Action call vía `archiveLibraryCategoryAction` — la action
 * revalida `/settings/library` y el page padre se re-renderea sin
 * la categoría archivada.
 */
export function ArchiveCategoryButton({ categoryId, categoryTitle }: Props): React.ReactNode {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  function handleConfirm(): void {
    startTransition(async () => {
      try {
        const result = await archiveLibraryCategoryAction({ categoryId })
        if (result.alreadyArchived) {
          toast.info('La categoría ya estaba archivada.')
        } else {
          toast.success('Categoría archivada.')
        }
        setOpen(false)
      } catch (err) {
        toast.error(friendlyLibraryErrorMessage(err))
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-border px-2.5 py-1.5 text-xs text-muted hover:text-text"
      >
        Archivar
      </button>
      <DialogContent>
        <DialogTitle>Archivar “{categoryTitle}”</DialogTitle>
        <DialogDescription>
          La categoría desaparece del listado de la biblioteca. Los recursos que tenga adentro
          siguen vivos (cuando existan items, R.7.6+) y vos podés volver a verla acá como admin.
        </DialogDescription>

        <div className="mt-5 flex justify-end gap-2">
          <DialogClose asChild>
            <button
              type="button"
              disabled={pending}
              className="rounded-md px-3 py-2 text-sm text-muted hover:text-text"
            >
              Cancelar
            </button>
          </DialogClose>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={pending}
            className="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 disabled:opacity-60"
          >
            {pending ? 'Archivando…' : 'Archivar'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
