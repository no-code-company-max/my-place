'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'

type TierOption = { id: string; name: string }
type GroupOption = { id: string; name: string }

type Props = {
  tiers: TierOption[]
  groups: GroupOption[]
}

/**
 * 3 selects para filtrar el directorio: grupo, tier, antigüedad.
 * URL state via query params (`?groupId=...&tierId=...&joinedSince=...`).
 * Cada cambio dispara `router.replace` conservando los demás params (incluido
 * `?q=` de la search bar).
 *
 * **Decisión 2026-05-04**: el filtro "Rol" se eliminó. Hay un solo rol
 * (Miembro); admin se modela como membership al preset group "Administradores"
 * — que ahora aparece como una opción más del dropdown "Grupos". El owner
 * que quiere ver admins selecciona "Administradores" en el dropdown. Owners
 * propiamente dichos (con PlaceOwnership) se gestionan en `/settings/access`.
 *
 * **Tier especial `__none__`**: la spec pide opción "Sin tiers asignados"
 * — no hay valor canónico para "ningún tier", así que usamos un sentinel
 * en la URL (`?tierId=__none__`). El page lo descarta antes de pasar a
 * `searchMembers` (TODO follow-up: la query no implementa `tierId=null`
 * todavía). v1: la opción aparece en el dropdown pero la query no
 * filtra — consistente con M.3 (sólo soporta filtrar POR tier asignado,
 * no SIN tier).
 *
 * **Botón "Limpiar filtros"**: visible si algún filtro está activo
 * (incluido `q`). Clears todos los params del URL.
 *
 * **`router.replace` (no `push`)**: cambiar filtro no debería pollutar
 * el history.
 */
const JOINED_SINCE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: '', label: 'Cualquier fecha' },
  { value: '7d', label: 'Últimos 7 días' },
  { value: '30d', label: 'Últimos 30 días' },
  { value: '90d', label: 'Últimos 90 días' },
  { value: '1y', label: 'Último año' },
]

const FILTER_KEYS = ['q', 'groupId', 'tierId', 'joinedSince'] as const

export function MemberFilters({ tiers, groups }: Props): React.ReactNode {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()

  const groupId = searchParams.get('groupId') ?? ''
  const tierId = searchParams.get('tierId') ?? ''
  const joinedSince = searchParams.get('joinedSince') ?? ''

  const hasAny = FILTER_KEYS.some((k) => {
    const v = searchParams.get(k)
    return v !== null && v.length > 0
  })

  const updateParam = (key: 'groupId' | 'tierId' | 'joinedSince', next: string): void => {
    const params = new URLSearchParams(searchParams.toString())
    if (next.length === 0) {
      params.delete(key)
    } else {
      params.set(key, next)
    }
    const qs = params.toString()
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false })
  }

  const handleClearAll = (): void => {
    const params = new URLSearchParams(searchParams.toString())
    for (const k of FILTER_KEYS) params.delete(k)
    const qs = params.toString()
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false })
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col">
        <span className="mb-1 block text-sm text-neutral-600">Grupo</span>
        <select
          aria-label="Filtrar por grupo"
          value={groupId}
          onChange={(e) => updateParam('groupId', e.target.value)}
          className="block min-h-[44px] w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-base focus:border-neutral-500 focus:outline-none"
        >
          <option value="">Todos los grupos</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col">
        <span className="mb-1 block text-sm text-neutral-600">Tier</span>
        <select
          aria-label="Filtrar por tier"
          value={tierId}
          onChange={(e) => updateParam('tierId', e.target.value)}
          className="block min-h-[44px] w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-base focus:border-neutral-500 focus:outline-none"
        >
          <option value="">Todos los tiers</option>
          <option value="__none__">Sin tiers asignados</option>
          {tiers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col">
        <span className="mb-1 block text-sm text-neutral-600">Antigüedad</span>
        <select
          aria-label="Filtrar por antigüedad"
          value={joinedSince}
          onChange={(e) => updateParam('joinedSince', e.target.value)}
          className="block min-h-[44px] w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-base focus:border-neutral-500 focus:outline-none"
        >
          {JOINED_SINCE_OPTIONS.map((o) => (
            <option key={o.value || 'any-date'} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      {hasAny ? (
        <button
          type="button"
          onClick={handleClearAll}
          className="ml-auto inline-flex min-h-11 items-center justify-center rounded-md border border-neutral-300 px-3 text-sm text-neutral-600 hover:border-neutral-500"
        >
          Limpiar filtros
        </button>
      ) : null}
    </div>
  )
}
