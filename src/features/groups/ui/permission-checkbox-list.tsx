'use client'

import {
  PERMISSIONS_ALL,
  permissionLabel,
  type Permission,
} from '@/features/groups/domain/permissions'

type Props = {
  value: ReadonlyArray<Permission>
  onChange: (next: Permission[]) => void
  disabled?: boolean
}

/**
 * Lista de 10 checkboxes — uno por permiso atómico. Client island.
 *
 * El parent maneja el array `value` y recibe `onChange(next)` con la
 * nueva lista (copia inmutable — patrón CLAUDE.md "Estado inmutable en
 * React").
 *
 * Visual discreto (CLAUDE.md "presencia silenciosa"): label + descripción
 * humana, sin iconos vistosos. La descripción del permiso vive en
 * `permissionLabel(p)`.
 */
export function PermissionCheckboxList({ value, onChange, disabled }: Props): React.ReactNode {
  const selected = new Set<Permission>(value)

  function togglePermission(permission: Permission, checked: boolean): void {
    if (checked) {
      if (selected.has(permission)) return
      onChange([...value, permission])
    } else {
      onChange(value.filter((p) => p !== permission))
    }
  }

  return (
    <fieldset className="space-y-2" disabled={disabled} aria-label="Permisos del grupo">
      <legend className="sr-only">Permisos del grupo</legend>
      {PERMISSIONS_ALL.map((p) => {
        const checked = selected.has(p)
        return (
          <label
            key={p}
            className="flex cursor-pointer items-start gap-2 rounded-md border border-border px-3 py-2 text-sm text-text hover:bg-soft"
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => togglePermission(p, e.target.checked)}
              disabled={disabled}
              className="mt-0.5 h-4 w-4 rounded border-border"
            />
            <span className="flex-1">
              <span className="block">{permissionLabel(p)}</span>
              <span className="mt-0.5 block font-mono text-xs text-muted">{p}</span>
            </span>
          </label>
        )
      })}
    </fieldset>
  )
}
