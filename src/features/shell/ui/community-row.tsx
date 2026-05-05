'use client'

import { Check } from 'lucide-react'
import type { MyPlace } from '@/features/places/public'
import { hashToIndex } from '@/shared/ui/avatar'

/**
 * Fila individual del dropdown del community switcher.
 *
 * Avatar 38×38 con color determinístico por slug — paleta local de 6
 * tonos warm distintos a la member palette (que viven en otro registro
 * visual). El handoff sugería derivar el color del `themeConfig.accent`
 * del place; queda como follow-up en R.2.2 para no extender el query
 * `listMyPlaces` en R.2.1.
 *
 * Si la fila representa el current place (`isCurrent=true`), tiene
 * `bg-accent-soft` y un check 20×20 a la derecha. Click en current
 * place es no-op (caller maneja).
 *
 * Ver `docs/features/shell/spec.md` § 5 (lista del dropdown).
 */
type Props = {
  place: MyPlace
  isCurrent: boolean
  onSelect: (slug: string) => void
}

const COMMUNITY_PALETTE: ReadonlyArray<string> = [
  '#b5633a', // warm-brown (accent)
  '#7a8c5a', // sage
  '#4f6b85', // dusty-blue
  '#8b6aa3', // muted-purple
  '#b08a3e', // ochre
  '#5e7d6f', // moss
] as const

export function CommunityRow({ place, isCurrent, onSelect }: Props): React.ReactNode {
  const initial = (place.name.trim()[0] ?? '?').toUpperCase()
  const color = COMMUNITY_PALETTE[hashToIndex(place.slug, COMMUNITY_PALETTE.length)]
  const roleLabel = place.isOwner ? 'Owner' : place.isAdmin ? 'Admin' : 'Miembro'

  return (
    <button
      type="button"
      role="menuitem"
      aria-current={isCurrent ? 'true' : undefined}
      onClick={() => onSelect(place.slug)}
      className={[
        'flex w-full items-center gap-3 rounded-[10px] px-3 py-2 text-left motion-safe:transition-colors',
        isCurrent ? 'bg-accent-soft' : 'hover:bg-soft',
      ].join(' ')}
    >
      <span
        aria-hidden="true"
        className="inline-flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] font-body text-base font-semibold text-bg"
        style={{ backgroundColor: color }}
      >
        {initial}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-body text-[15px] font-semibold tracking-tight text-text">
          {place.name}
        </span>
        <span className="block truncate font-body text-xs text-muted">{roleLabel}</span>
      </span>
      {isCurrent ? (
        <span
          aria-hidden="true"
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-bg"
        >
          <Check size={12} />
        </span>
      ) : null}
    </button>
  )
}
