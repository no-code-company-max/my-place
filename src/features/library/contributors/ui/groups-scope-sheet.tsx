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
import { friendlyLibraryErrorMessage } from '@/features/library/public'
import type { GroupOption } from '@/features/library/wizard/public'
import { setLibraryCategoryGroupScopeAction } from '../server/actions/set-category-group-scope'

/**
 * BottomSheet para gestionar grupos asignados (scope) de una categoría
 * con `contributionPolicy === 'SELECTED_GROUPS'`.
 *
 * Patrón paralelo a `<ContributorsSheet>` (DESIGNATED), pero más simple:
 * el set total de grupos del place es chico (típicamente <10) y todos
 * caben en una lista de checkboxes — sin buscador ni autocomplete.
 *
 * Modelo de save: el sheet mantiene un set local que el owner edita
 * libremente; al tocar "Guardar" el set completo se persiste vía
 * `setLibraryCategoryGroupScopeAction` (override completo). Si el assign
 * falla por payload inválido (`group_not_in_place`), toast lo aclara y el
 * set local se preserva para reintento.
 *
 * Decisión #B ADR `2026-05-04-library-contribution-policy-groups.md`:
 * el preset "Administradores" aparece como un grupo elegible más, listado
 * primero por convención visual.
 */

type Props = {
  open: boolean
  onOpenChange: (next: boolean) => void
  categoryId: string
  categoryTitle: string
  /** IDs actualmente asignados — popula los checkboxes al abrir. */
  initialGroupIds: ReadonlyArray<string>
  /** Permission groups del place — fuente del picker. */
  groups: ReadonlyArray<GroupOption>
}

export function GroupsScopeSheet({
  open,
  onOpenChange,
  categoryId,
  categoryTitle,
  initialGroupIds,
  groups,
}: Props): React.ReactNode {
  const [pending, startTransition] = useTransition()
  const [selected, setSelected] = useState<Set<string>>(new Set(initialGroupIds))

  // Reset al abrir — el padre puede reabrir con distintos initialGroupIds
  // entre aperturas; sin esto el set queda fantasma.
  useEffect(() => {
    if (open) {
      setSelected(new Set(initialGroupIds))
    }
    // initialGroupIds es estable durante una apertura.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const sortedGroups = [...groups].sort((a, b) => {
    if (a.isPreset && !b.isPreset) return -1
    if (!a.isPreset && b.isPreset) return 1
    return a.name.localeCompare(b.name)
  })

  function toggle(groupId: string): void {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  function handleSave(): void {
    startTransition(async () => {
      try {
        const result = await setLibraryCategoryGroupScopeAction({
          categoryId,
          groupIds: Array.from(selected),
        })
        if (!result.ok) {
          // group_not_in_place — payload manipulado o stale. Preservamos
          // selected para que el owner reintente sin perder su edición.
          toast.error('Algún grupo no pertenece a este place. Recargá la página.')
          return
        }
        toast.success('Grupos actualizados.')
        onOpenChange(false)
      } catch (err) {
        toast.error(friendlyLibraryErrorMessage(err))
      }
    })
  }

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent aria-describedby={undefined}>
        <BottomSheetHeader>
          <BottomSheetTitle>Grupos con permiso en “{categoryTitle}”</BottomSheetTitle>
          <BottomSheetDescription>
            Solo los miembros de los grupos seleccionados pueden agregar contenido (además del
            owner).
          </BottomSheetDescription>
        </BottomSheetHeader>

        <BottomSheetBody>
          <div className="space-y-3 py-2">
            {sortedGroups.length === 0 ? (
              <p className="text-sm italic text-neutral-500">
                Este place no tiene grupos creados todavía. Creá uno en{' '}
                <span className="font-mono">/settings/groups</span>.
              </p>
            ) : (
              <div className="divide-y divide-neutral-200 border-y border-neutral-200">
                {sortedGroups.map((g) => {
                  const checked = selected.has(g.id)
                  return (
                    <label
                      key={g.id}
                      className="flex min-h-11 cursor-pointer items-center gap-3 py-2"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(g.id)}
                        className="h-4 w-4"
                      />
                      <span className="flex-1 text-sm">
                        {g.name}
                        {g.isPreset ? (
                          <span className="ml-2 rounded-full border border-amber-300 px-2 py-0.5 text-[11px] text-amber-700">
                            preset
                          </span>
                        ) : null}
                      </span>
                    </label>
                  )
                })}
              </div>
            )}
            <p className="text-xs text-neutral-600">
              {selected.size} {selected.size === 1 ? 'grupo seleccionado' : 'grupos seleccionados'}
            </p>
          </div>
        </BottomSheetBody>

        <BottomSheetFooter>
          <button
            type="button"
            onClick={handleSave}
            disabled={pending}
            className="inline-flex min-h-12 w-full items-center justify-center rounded-md bg-neutral-900 px-4 text-sm font-medium text-white disabled:opacity-60"
          >
            {pending ? 'Guardando…' : 'Guardar'}
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
      </BottomSheetContent>
    </BottomSheet>
  )
}
