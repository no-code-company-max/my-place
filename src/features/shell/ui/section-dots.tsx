'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ZONES, deriveActiveZone } from '../domain/zones'

/**
 * Dots de navegación entre zonas del place. Cada dot es un `<Link>` a la
 * zona correspondiente. El dot activo (derivado de `pathname`) crece a un
 * pill 18×6 con `bg-text`. Los inactivos quedan como círculo 6×6 con
 * `bg-dot`.
 *
 * Client component porque usa `usePathname()` para derivar el active
 * state. El "flicker" entre SSR (sin active) e hidratación (con active)
 * es aceptable: la transición CSS de 220ms enmascara el cambio.
 *
 * Si el place está cerrado (PlaceClosedView en gated), el caller pasa
 * `disabled` para mostrar dots con `opacity-50 pointer-events-none` —
 * el chrome sigue visible pero las zonas no son navegables.
 *
 * Ver `docs/features/shell/spec.md` § 4 (componentes) y § 10 (mount).
 */
export function SectionDots({ disabled = false }: { disabled?: boolean }): React.ReactNode {
  const pathname = usePathname()
  const activeZone = deriveActiveZone(pathname)

  return (
    <nav
      aria-label="Zonas del place"
      className={[
        'flex h-7 items-center justify-center gap-1.5',
        disabled ? 'pointer-events-none opacity-50' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {ZONES.map((zone) => {
        const isActive = zone.index === activeZone
        return (
          <Link
            key={zone.index}
            href={zone.path}
            aria-label={`Ir a ${zone.label}`}
            aria-current={isActive ? 'page' : undefined}
            className={[
              'inline-block h-1.5 rounded-full transition-[width,background-color] duration-[220ms] ease-[cubic-bezier(.3,.7,.4,1)]',
              isActive ? 'w-[18px] bg-text' : 'w-1.5 bg-dot',
            ].join(' ')}
          />
        )
      })}
    </nav>
  )
}
