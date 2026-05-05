import Link from 'next/link'
import type { MemberSummary } from '@/features/members/public.server'
import { MemberRow } from './member-row'

type Props = {
  placeSlug: string
  members: MemberSummary[]
  hasActiveFilters: boolean
}

/**
 * Lista de miembros del directorio. Server Component puro: recibe data
 * por props (el page hace `searchMembers`).
 *
 * Empty state distingue dos casos:
 *  - Sin filtros + sin miembros: el place no tiene miembros activos
 *    (raro, sólo mientras está vacío post-creación).
 *  - Con filtros + sin resultados: muestra "Sin resultados" + CTA
 *    "Limpiar filtros" (link a `/settings/members` sin query params).
 *
 * Sin grito visual, sin animaciones — alineado con principio "nada
 * parpadea, nada grita".
 */
export function MembersList({
  placeSlug: _placeSlug,
  members,
  hasActiveFilters,
}: Props): React.ReactNode {
  if (members.length === 0) {
    if (hasActiveFilters) {
      return (
        <div className="space-y-3">
          <p className="text-sm italic text-neutral-500">
            Sin resultados para los filtros aplicados.
          </p>
          <Link
            href="/settings/members"
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-neutral-300 px-3 text-sm text-neutral-600 hover:border-neutral-500"
          >
            Limpiar filtros
          </Link>
        </div>
      )
    }
    return (
      <p className="text-sm italic text-neutral-500">
        Este place todavía no tiene miembros activos.
      </p>
    )
  }

  return (
    <ul className="divide-y divide-neutral-200 border-y border-neutral-200">
      {members.map((member) => (
        <li key={member.membershipId} className="flex min-h-[56px] items-center gap-3 py-2">
          <MemberRow member={member} />
        </li>
      ))}
    </ul>
  )
}
