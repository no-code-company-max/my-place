'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/shared/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'
import { archiveLibraryItemAction, friendlyLibraryErrorMessage } from '@/features/library/public'

type Props = {
  itemId: string
  categorySlug: string
  postSlug: string
  /** Permisos calculados en el page padre (canEditItem + canArchiveItem
   *  hoy son la misma matriz, pero pasamos ambas por si divergen). */
  canEdit: boolean
  canArchive: boolean
}

/**
 * Menú contextual del item de biblioteca (R.7.9). Acciones según
 * permisos:
 *   - Editar → link a `/library/[cat]/[postSlug]/edit`.
 *   - Archivar → confirm dialog → archiveLibraryItemAction.
 *
 * Solo se monta para admin/owner del place o author del item; el page
 * padre decide el render condicional. Si llega con ambos `false`, el
 * componente retorna null (defensivo).
 */
export function ItemAdminMenu({
  itemId,
  categorySlug,
  postSlug,
  canEdit,
  canArchive,
}: Props): React.ReactNode {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!canEdit && !canArchive) return null

  const confirmArchive = () => {
    setError(null)
    startTransition(async () => {
      try {
        await archiveLibraryItemAction({ itemId })
        setConfirmOpen(false)
        // Redirect al listado de la categoría — el item ya no aparece.
        router.replace(`/library/${categorySlug}`)
      } catch (err) {
        setError(friendlyLibraryErrorMessage(err))
      }
    })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Acciones del recurso"
            className="rounded p-1 text-muted hover:text-text focus:outline-none focus-visible:ring-1 focus-visible:ring-bg"
            disabled={pending}
          >
            <KebabIcon />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {canEdit ? (
            <DropdownMenuItem asChild>
              <Link href={`/library/${categorySlug}/${postSlug}/edit`}>Editar</Link>
            </DropdownMenuItem>
          ) : null}
          {canArchive ? (
            <DropdownMenuItem onSelect={() => setConfirmOpen(true)} disabled={pending}>
              Archivar
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogTitle>Archivar recurso</DialogTitle>
          <DialogDescription>
            El recurso desaparece del listado de la categoría. La conversación que se generó
            alrededor sigue visible en discusiones; podés restaurarlo después si hace falta.
          </DialogDescription>
          {error ? (
            <p role="alert" className="mt-3 text-sm text-amber-900">
              {error}
            </p>
          ) : null}
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
              onClick={confirmArchive}
              disabled={pending}
              className="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 disabled:opacity-60"
            >
              {pending ? 'Archivando…' : 'Archivar'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function KebabIcon(): React.ReactNode {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="3" r="1.5" fill="currentColor" />
      <circle cx="8" cy="8" r="1.5" fill="currentColor" />
      <circle cx="8" cy="13" r="1.5" fill="currentColor" />
    </svg>
  )
}
