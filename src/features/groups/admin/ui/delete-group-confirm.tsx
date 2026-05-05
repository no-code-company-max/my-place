'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/shared/ui/dialog'
import { toast } from '@/shared/ui/toaster'
import { deleteGroupAction } from '@/features/groups/public'
import { friendlyGroupErrorMessage } from '@/features/groups/ui/errors'

type Props = {
  open: boolean
  onOpenChange: (next: boolean) => void
  groupId: string
  groupName: string
  /** Slug del place — usado para redirigir al listado tras delete exitoso. */
  placeSlug: string
}

/**
 * Confirm dialog destructivo para eliminar un grupo. Owner-only.
 *
 * Es un `<Dialog>` (modal centrado) y NO un `<BottomSheet>` porque, según
 * el doc de UX patterns, los confirms de acción destructiva (1 sola
 * pregunta sí/no) se benefician del foco que da el modal centrado.
 *
 * Estilo destructivo canónico: cancel `border-neutral-300`, confirm
 * `border-red-600 bg-red-600 text-white` (mismo patrón que
 * `<ArchiveCategoryConfirm>` pero rojo en lugar de amber porque el delete
 * es **irreversible** — amber se reserva para soft-delete recuperable).
 *
 * El guard de no-eliminar-preset y de no-eliminar-grupo-con-miembros vive
 * antes — el caller (`GroupDetailView`) sólo monta este confirm cuando
 * el grupo es eliminable. Defense in depth en el server action igualmente
 * (puede devolver `cannot_delete_preset` o `group_has_members`).
 *
 * Tras el delete exitoso, redirige a `/settings/groups` (la page detail
 * deja de existir). El revalidatePath del action sincroniza el listado.
 */
export function DeleteGroupConfirm({
  open,
  onOpenChange,
  groupId,
  groupName,
  placeSlug,
}: Props): React.ReactNode {
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function handleConfirm(): void {
    startTransition(async () => {
      try {
        const result = await deleteGroupAction({ groupId })
        if (!result.ok) {
          if (result.error === 'cannot_delete_preset') {
            toast.error('El preset Administradores no se puede eliminar.')
          } else if (result.error === 'group_has_members') {
            toast.error('Quitá los miembros del grupo antes de eliminar.')
          }
          onOpenChange(false)
          return
        }
        toast.success('Grupo eliminado.')
        onOpenChange(false)
        // URLs públicas son subdominio — no incluir placeSlug en path.
        router.push('/settings/groups')
      } catch (err) {
        toast.error(friendlyGroupErrorMessage(err))
      }
    })
  }

  // Voidear placeSlug en run-time es innecesario, pero el linter no se
  // queja: la prop la usa `router.push` indirectamente vía la URL absoluta
  // del subdominio. La declaramos por si se necesita para otros side-
  // effects (ej. revalidatePath manual).
  void placeSlug

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Eliminar “{groupName}”</DialogTitle>
        <DialogDescription>
          El grupo y sus permisos se eliminan permanentemente. Esta acción no se puede deshacer.
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
            {pending ? 'Eliminando…' : 'Sí, eliminar'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
