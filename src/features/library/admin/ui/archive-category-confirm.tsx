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
import {
  archiveLibraryCategoryAction,
  friendlyLibraryErrorMessage,
} from '@/features/library/public'

type Props = {
  open: boolean
  onOpenChange: (next: boolean) => void
  categoryId: string
  categoryTitle: string
}

/**
 * Confirm dialog para archivar una categoría. Archivar es soft-delete
 * (la categoría no se destruye — sus items quedan vivos cuando R.7.6
 * los sume) pero sí desaparece del listado de members. El confirm
 * evita archivar por accidente.
 *
 * Es un `<Dialog>` (modal centrado) y NO un `<BottomSheet>` porque,
 * según el doc de UX patterns, los confirms de acción destructiva
 * (1 sola pregunta sí/no) se benefician del foco que da el modal
 * centrado — los sheets son para forms con múltiples inputs.
 *
 * Componente controlado: el trigger vive afuera (en el dropdown menu
 * de cada row de `<CategoryListAdmin>`); este archivo expone solo el
 * confirm.
 *
 * Action call vía `archiveLibraryCategoryAction` — la action revalida
 * `/settings/library` y el page padre se re-renderea sin la categoría
 * archivada.
 */
export function ArchiveCategoryConfirm({
  open,
  onOpenChange,
  categoryId,
  categoryTitle,
}: Props): React.ReactNode {
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
        onOpenChange(false)
      } catch (err) {
        toast.error(friendlyLibraryErrorMessage(err))
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
              className="inline-flex min-h-11 items-center rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:opacity-60"
            >
              Cancelar
            </button>
          </DialogClose>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={pending}
            className="inline-flex min-h-11 items-center rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 disabled:opacity-60"
          >
            {pending ? 'Archivando…' : 'Archivar'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
