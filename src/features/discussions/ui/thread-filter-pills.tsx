'use client'

import { useState } from 'react'

/**
 * Filter pills para la lista de threads (R.6).
 *
 * 3 opciones del handoff: `Todos` (default activo), `Sin respuesta`,
 * `En los que participo`.
 *
 * **Estado R.6**: solo `Todos` es funcional. Los otros 2 quedan
 * `aria-disabled="true"` con `title="Próximamente"` y opacidad reducida
 * — visibles para preservar el chrome del handoff sin requerir backend
 * extension. Los filtros reales se implementan en R.6.X follow-up
 * extendiendo `listPostsByPlace` con `filter` arg.
 *
 * Como solo "Todos" funciona, NO hay state real (cero re-render). El
 * pill activo está hardcoded. Cuando se habilite, este componente
 * cambia a state local que dispara router refresh con query param.
 *
 * Ver `docs/features/discussions/spec.md` § 21.4.
 */

type FilterValue = 'all' | 'unanswered' | 'participating'

const PILLS: ReadonlyArray<{
  value: FilterValue
  label: string
  enabled: boolean
}> = [
  { value: 'all', label: 'Todos', enabled: true },
  { value: 'unanswered', label: 'Sin respuesta', enabled: false },
  { value: 'participating', label: 'En los que participo', enabled: false },
]

export function ThreadFilterPills(): React.ReactNode {
  // R.6 placeholder: el state existe pero solo permite "all" — el setter
  // queda sin uso real hasta R.6.X (follow-up con extension del query).
  const [active] = useState<FilterValue>('all')

  return (
    <nav
      aria-label="Filtrar discusiones"
      role="tablist"
      className="flex gap-1.5 overflow-x-auto px-3 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {PILLS.map((pill) => {
        const isActive = pill.value === active
        const isDisabled = !pill.enabled
        return (
          <button
            key={pill.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-disabled={isDisabled || undefined}
            title={isDisabled ? 'Próximamente' : undefined}
            disabled={isDisabled}
            className={[
              'shrink-0 rounded-full px-[14px] py-2 font-body text-[13px] font-medium motion-safe:transition-colors',
              isActive
                ? 'bg-text text-bg'
                : 'border-[0.5px] border-border bg-transparent text-muted',
              isDisabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-soft',
            ].join(' ')}
          >
            {pill.label}
          </button>
        )
      })}
    </nav>
  )
}
