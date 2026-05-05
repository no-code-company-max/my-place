'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
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
import { MemberAvatar } from '@/features/members/public'
import {
  friendlyLibraryErrorMessage,
  type LibraryCategoryContributor,
} from '@/features/library/public'
import { inviteContributorAction } from '../server/actions/invite-contributor'
import { removeContributorAction } from '../server/actions/remove-contributor'

type MemberOption = {
  userId: string
  displayName: string
  avatarUrl: string | null
  handle: string | null
}

type Props = {
  open: boolean
  onOpenChange: (next: boolean) => void
  categoryId: string
  categoryTitle: string
  /** Lista actual de contributors (snapshot del server al render). El
   *  componente mantiene una copia local mutable para feedback óptico
   *  antes de que el revalidate llegue. */
  initialContributors: ReadonlyArray<LibraryCategoryContributor>
  /** Members activos del place — fuente para el picker. Se pasa desde
   *  el page padre (ya cargado vía `listActiveMembers`). */
  members: ReadonlyArray<MemberOption>
}

/**
 * BottomSheet para gestionar contribuidores designated de una categoría.
 *
 * Solo aplica cuando `category.contributionPolicy === 'DESIGNATED'`.
 * El page padre / `<CategoryListAdmin>` decide cuándo abrirlo según la
 * policy de cada categoría.
 *
 * UX:
 *  - Lista de contributors actuales con avatar + nombre + botón "Quitar"
 *    inline.
 *  - Input de búsqueda con autocomplete sobre `members` filtrando los
 *    que ya están invitados (max 8 candidatos).
 *  - Click en un resultado → `inviteContributorAction`.
 *  - Click en "Quitar" → `removeContributorAction`.
 *
 * Optimistic local update (`useState`) para que el cambio se vea al
 * instante; la revalidación del server (vía `revalidatePath` en la
 * action) sincroniza después. Si la action falla, se hace rollback
 * local.
 *
 * El `query` se resetea al cerrar; `list` queda como está y se sincroniza
 * con `initialContributors` cuando el padre re-renderea con datos frescos.
 */
export function ContributorsSheet({
  open,
  onOpenChange,
  categoryId,
  categoryTitle,
  initialContributors,
  members,
}: Props): React.ReactNode {
  const [pending, startTransition] = useTransition()
  const [list, setList] = useState<ReadonlyArray<LibraryCategoryContributor>>(initialContributors)
  const [query, setQuery] = useState('')

  // Reset del input de búsqueda al cerrar el sheet. `list` se mantiene —
  // refleja el último estado óptico; en el próximo render del padre
  // post-revalidate, `initialContributors` viene fresco y un próximo open
  // arranca con la verdad del server (a través del prop, no se re-sincroniza
  // automáticamente porque `list` ya partió de él como estado inicial).
  useEffect(() => {
    if (!open) {
      setQuery('')
    }
  }, [open])

  const invitedIds = useMemo(() => new Set(list.map((c) => c.userId)), [list])

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase()
    return members
      .filter((m) => !invitedIds.has(m.userId))
      .filter((m) => {
        if (q.length === 0) return true
        return (
          m.displayName.toLowerCase().includes(q) || (m.handle?.toLowerCase().includes(q) ?? false)
        )
      })
      .slice(0, 8)
  }, [members, invitedIds, query])

  function invite(target: MemberOption): void {
    const previous = list
    const optimistic: LibraryCategoryContributor = {
      categoryId,
      userId: target.userId,
      displayName: target.displayName,
      avatarUrl: target.avatarUrl,
      invitedAt: new Date(),
      invitedByUserId: 'self',
      invitedByDisplayName: 'Vos',
    }
    setList([...list, optimistic])
    setQuery('')

    startTransition(async () => {
      try {
        const res = await inviteContributorAction({ categoryId, userId: target.userId })
        if (res.alreadyInvited) {
          toast.info(`${target.displayName} ya estaba invitado.`)
        } else {
          toast.success(`${target.displayName} fue agregado.`)
        }
      } catch (err) {
        setList(previous)
        toast.error(friendlyLibraryErrorMessage(err))
      }
    })
  }

  function remove(target: LibraryCategoryContributor): void {
    const previous = list
    setList(list.filter((c) => c.userId !== target.userId))

    startTransition(async () => {
      try {
        await removeContributorAction({ categoryId, userId: target.userId })
        toast.success(`${target.displayName} fue quitado.`)
      } catch (err) {
        setList(previous)
        toast.error(friendlyLibraryErrorMessage(err))
      }
    })
  }

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent aria-describedby={undefined}>
        <BottomSheetHeader>
          <BottomSheetTitle>Contribuidores de “{categoryTitle}”</BottomSheetTitle>
          <BottomSheetDescription>
            Las personas que pueden agregar contenido en esta categoría. Los admins siempre pueden
            aunque no estén en la lista.
          </BottomSheetDescription>
        </BottomSheetHeader>

        <BottomSheetBody>
          <div className="space-y-4 py-2">
            {list.length === 0 ? (
              <p className="text-sm italic text-neutral-500">
                Todavía nadie tiene permiso. Agregá miembros desde el buscador.
              </p>
            ) : (
              <ul className="divide-y divide-neutral-200 border-y border-neutral-200">
                {list.map((contributor) => (
                  <li
                    key={contributor.userId}
                    className="flex min-h-[56px] items-center gap-3 py-2"
                  >
                    <MemberAvatar
                      userId={contributor.userId}
                      displayName={contributor.displayName}
                      avatarUrl={contributor.avatarUrl}
                      size={32}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{contributor.displayName}</p>
                      <p className="truncate text-xs text-neutral-600">
                        Invitado por {contributor.invitedByDisplayName}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(contributor)}
                      disabled={pending}
                      className="inline-flex min-h-11 items-center rounded-md px-3 text-xs text-neutral-600 hover:text-neutral-900 disabled:opacity-60"
                      aria-label={`Quitar a ${contributor.displayName}`}
                    >
                      Quitar
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div>
              <label className="block">
                <span className="mb-1 block text-sm text-neutral-600">Agregar contribuidor</span>
                <input
                  type="text"
                  placeholder="Buscar miembro por nombre o handle…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="block min-h-[44px] w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-base focus:border-neutral-500 focus:outline-none"
                />
              </label>

              {query.trim().length > 0 || candidates.length > 0 ? (
                <ul className="mt-2 divide-y divide-neutral-200 border-y border-neutral-200">
                  {candidates.length === 0 ? (
                    <li className="py-3 text-sm italic text-neutral-500">
                      {query.trim().length > 0
                        ? 'Ningún miembro coincide.'
                        : 'Todos los miembros del place ya están invitados.'}
                    </li>
                  ) : (
                    candidates.map((m) => (
                      <li key={m.userId}>
                        <button
                          type="button"
                          onClick={() => invite(m)}
                          disabled={pending}
                          className="flex min-h-[56px] w-full items-center gap-3 py-2 text-left hover:bg-neutral-50 disabled:opacity-60"
                        >
                          <MemberAvatar
                            userId={m.userId}
                            displayName={m.displayName}
                            avatarUrl={m.avatarUrl}
                            size={32}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{m.displayName}</p>
                            {m.handle ? (
                              <p className="truncate text-xs text-neutral-600">@{m.handle}</p>
                            ) : null}
                          </div>
                          <span className="inline-flex min-h-11 items-center px-2 text-xs text-neutral-700">
                            Invitar
                          </span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              ) : null}
            </div>
          </div>
        </BottomSheetBody>

        <BottomSheetFooter>
          <BottomSheetClose asChild>
            <button
              type="button"
              className="inline-flex min-h-12 w-full items-center justify-center rounded-md bg-neutral-900 px-4 text-sm font-medium text-white"
            >
              Listo
            </button>
          </BottomSheetClose>
        </BottomSheetFooter>
      </BottomSheetContent>
    </BottomSheet>
  )
}
