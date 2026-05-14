'use client'

import { useState } from 'react'

/**
 * Selector de prereq controlled — uso dentro del composer del item
 * (CREATE + EDIT). A diferencia de `<PrereqSelector>` (que persiste
 * inmediatamente con `setItemPrereqAction`), este componente acumula
 * la selección en state local y delega al caller (el composer)
 * disparar la action en submit.
 *
 * UX:
 *  - Toggle (checkbox) "¿Esta lección depende de otra?". Default off.
 *  - Si on: muestra un `<select>` con los items de la misma categoría
 *    como opciones. Vacío = ninguno seleccionado (forzar elección).
 *  - Si off: el valor se resetea a `null` (limpiar prereq al guardar).
 *
 * `value === null` ⇒ sin prereq. `value === 'item-x'` ⇒ con prereq.
 *
 * 50 items max por curso (cap UX): `<select>` plano funciona OK. Si
 * crece a cientos, migrar a combobox con búsqueda (`SearchableMultiSelect`
 * tiene primitive base pero es multi-select; necesitaría adaptación).
 */
type Props = {
  availableItems: ReadonlyArray<{ id: string; title: string }>
  value: string | null
  onChange: (next: string | null) => void
  disabled?: boolean
}

export function PrereqToggleSelector({
  availableItems,
  value,
  onChange,
  disabled = false,
}: Props): React.ReactNode {
  const [open, setOpen] = useState<boolean>(value !== null)

  function handleToggle(e: React.ChangeEvent<HTMLInputElement>): void {
    const next = e.target.checked
    setOpen(next)
    if (!next) onChange(null)
  }

  function handleSelect(e: React.ChangeEvent<HTMLSelectElement>): void {
    const next = e.target.value
    onChange(next === '' ? null : next)
  }

  if (availableItems.length === 0) {
    return (
      <div className="rounded-md border border-border bg-surface p-3">
        <p className="text-sm text-muted">
          Esta categoría todavía no tiene otras lecciones. Cuando publiques más, vas a poder marcar
          de cuál depende esta.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-md border border-border bg-surface p-3">
      <label className="flex min-h-11 items-start gap-2 text-sm text-text">
        <input
          type="checkbox"
          className="mt-1.5"
          checked={open}
          onChange={handleToggle}
          disabled={disabled}
        />
        <span>
          <span className="font-medium">¿Esta lección depende de otra?</span>
          <span className="mt-0.5 block text-xs text-muted">
            Si está marcado, los miembros tienen que completar la lección elegida antes de poder
            abrir esta.
          </span>
        </span>
      </label>

      {open ? (
        <label className="block">
          <span className="mb-1 block text-sm text-muted">Lección requerida</span>
          <select
            value={value ?? ''}
            onChange={handleSelect}
            disabled={disabled}
            className="w-full rounded-md border border-border bg-bg px-3 py-2 text-text focus:border-text focus:outline-none"
          >
            <option value="">Elegí una lección…</option>
            {availableItems.map((it) => (
              <option key={it.id} value={it.id}>
                {it.title}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
  )
}
