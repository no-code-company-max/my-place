'use client'

type CategoryOption = {
  id: string
  emoji: string
  title: string
}

type Props = {
  value: ReadonlyArray<string>
  categories: ReadonlyArray<CategoryOption>
  onChange: (next: string[]) => void
  /**
   * Si `false`, el selector se renderiza con todos los checks deshabilitados +
   * un mensaje explicativo (no hay permisos library:* seleccionados, scope
   * no aplica). El parent calcula esto con `isLibraryScopedPermission`.
   */
  enabled: boolean
}

/**
 * Multi-select de categorías de library para configurar scope de un
 * grupo. Client island. Lista vacía → grupo opera global sobre todas
 * las categorías (sin entries en `GroupCategoryScope`).
 *
 * Visual: lista de checkboxes, una por categoría. Header explicativo
 * arriba con el comportamiento "vacío == todas".
 *
 * Si `enabled=false` (sin permisos library:* seleccionados), el control
 * se deshabilita + muestra hint.
 */
export function CategoryScopeSelector({
  value,
  categories,
  onChange,
  enabled,
}: Props): React.ReactNode {
  const selected = new Set(value)

  function toggleCategory(categoryId: string, checked: boolean): void {
    if (checked) {
      if (selected.has(categoryId)) return
      onChange([...value, categoryId])
    } else {
      onChange(value.filter((id) => id !== categoryId))
    }
  }

  if (categories.length === 0) {
    return (
      <p className="text-sm text-muted">
        Este place todavía no tiene categorías de biblioteca. Creá algunas en Biblioteca para poder
        scopear permisos.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted">
        Si dejás esto vacío, los permisos library del grupo aplican a TODAS las categorías. Marcá
        categorías para limitar el scope.
      </p>
      <fieldset
        className="space-y-1"
        disabled={!enabled}
        aria-label="Categorías de biblioteca scopadas"
      >
        <legend className="sr-only">Categorías scopadas</legend>
        {!enabled && (
          <p className="text-xs text-muted">Activá un permiso library para configurar el scope.</p>
        )}
        {categories.map((cat) => {
          const checked = selected.has(cat.id)
          return (
            <label
              key={cat.id}
              className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-text hover:bg-soft"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => toggleCategory(cat.id, e.target.checked)}
                disabled={!enabled}
                className="h-4 w-4 rounded border-border"
              />
              <span className="text-base" aria-hidden>
                {cat.emoji}
              </span>
              <span>{cat.title}</span>
            </label>
          )
        })}
      </fieldset>
    </div>
  )
}
