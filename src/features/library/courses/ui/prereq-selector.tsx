'use client'

import { useState, useTransition } from 'react'
import { setItemPrereqAction } from '@/features/library/courses/public'
import { toast } from '@/shared/ui/toaster'

/**
 * Selector de prereq para items en categorías `kind === 'COURSE'`.
 *
 * Render: `<select>` con la lista de items de la misma categoría como
 * opciones (excluye el item actual — autoreferencia se valida igual en
 * el server, pero acá es UX cleaner). Primera opción "Sin prereq" =
 * limpia el prereq.
 *
 * onChange: llama `setItemPrereqAction` (Server Action). Resultado por
 * discriminated union (Next 15 — gotcha CLAUDE.md). Toasts:
 *  - ok → "Prereq actualizado." / "Prereq removido."
 *  - cycle_detected → "Eso crearía un ciclo."
 *  - prereq_not_in_category → "El item elegido no pertenece a esta categoría."
 *  - category_not_course → defensive ("La categoría no es un curso.")
 *
 * Solo se renderiza en EDIT (no CREATE) — un item recién creado no tiene
 * id todavía hasta que se publica. Si el form quiere prereq al crear, el
 * usuario lo setea en una segunda pasada (UX más simple, sin coupling
 * temporal entre 2 actions).
 *
 * Decisión #D2 + #D4 ADR `2026-05-04-library-courses-and-read-access.md`.
 */
type PrereqOption = {
  id: string
  title: string
}

type Props = {
  itemId: string
  /** Items siblings en la misma categoría — el caller filtra: excluye
   *  el item actual + items archivados. */
  availableItems: ReadonlyArray<PrereqOption>
  /** Prereq actual del item (null = sin prereq). */
  currentPrereqId: string | null
}

const ERROR_COPY: Record<string, string> = {
  cycle_detected: 'Eso crearía un ciclo en la cadena de prereqs.',
  prereq_not_in_category: 'El item elegido no pertenece a esta categoría.',
  category_not_course: 'Esta categoría no es un curso.',
}

export function PrereqSelector({
  itemId,
  availableItems,
  currentPrereqId,
}: Props): React.ReactNode {
  const [value, setValue] = useState<string>(currentPrereqId ?? '')
  const [pending, startTransition] = useTransition()

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>): void {
    const next = e.target.value
    const previous = value
    setValue(next)
    startTransition(async () => {
      try {
        const result = await setItemPrereqAction({
          itemId,
          prereqItemId: next === '' ? null : next,
        })
        if (result.ok) {
          toast.success(next === '' ? 'Prereq removido.' : 'Prereq actualizado.')
        } else {
          setValue(previous)
          toast.error(ERROR_COPY[result.error] ?? 'No pudimos actualizar el prereq.')
        }
      } catch {
        setValue(previous)
        toast.error('No pudimos actualizar el prereq. Reintentá en un momento.')
      }
    })
  }

  return (
    <label className="block">
      <span className="mb-1 block text-sm text-muted">Prereq (opcional)</span>
      <select
        value={value}
        onChange={handleChange}
        disabled={pending || availableItems.length === 0}
        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-text focus:border-bg focus:outline-none"
      >
        <option value="">Sin prereq — siempre abrible</option>
        {availableItems.map((it) => (
          <option key={it.id} value={it.id}>
            {it.title}
          </option>
        ))}
      </select>
      <span className="mt-1 block text-xs text-muted">
        {availableItems.length === 0
          ? 'Esta categoría no tiene otros items todavía. Creá uno y volvé a esta vista para asignarlo.'
          : 'Cuando alguien abre este item, primero tiene que haber completado el prereq.'}
      </span>
    </label>
  )
}
