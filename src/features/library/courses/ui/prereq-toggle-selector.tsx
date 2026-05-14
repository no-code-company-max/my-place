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
 *  - Switch (`role="switch"`) "¿Esta lección depende de otra?".
 *    Default off. Mismo patrón visual que `<PluginSwitch>` /
 *    `<DaySwitch>` de editor-config + hours, adaptado a tokens
 *    brand (gated zone usa CSS vars del place, no tailwind neutrals).
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

  function handleToggle(next: boolean): void {
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
      <div className="flex min-h-11 items-start gap-3">
        <div className="min-w-0 flex-1 text-sm text-text">
          <span className="font-medium">¿Esta lección depende de otra?</span>
          <span className="mt-0.5 block text-xs text-muted">
            Si está activado, los miembros tienen que completar la lección elegida antes de poder
            abrir esta.
          </span>
        </div>
        <PrereqSwitch isOn={open} disabled={disabled} onToggle={handleToggle} />
      </div>

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

/**
 * Switch accesible sin dep nueva. `role="switch"` + `aria-checked` cumplen
 * WAI-ARIA. Touch target 44px (el contenedor padre tiene min-h-11 →
 * 44px). Tokens brand del place (zona gated): `bg-text` / `bg-border` /
 * `bg-surface` en lugar de neutrals tailwind.
 */
function PrereqSwitch({
  isOn,
  disabled,
  onToggle,
}: {
  isOn: boolean
  disabled: boolean
  onToggle: (next: boolean) => void
}): React.ReactNode {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isOn}
      aria-label={`Lección con prerequisito: ${isOn ? 'activado, tocá para desactivar' : 'desactivado, tocá para activar'}`}
      disabled={disabled}
      onClick={() => onToggle(!isOn)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text disabled:cursor-not-allowed disabled:opacity-60 ${
        isOn ? 'bg-text' : 'bg-border'
      }`}
    >
      <span
        aria-hidden="true"
        className={`inline-block h-5 w-5 transform rounded-full bg-surface shadow transition-transform ${
          isOn ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}
