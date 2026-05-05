import Link from 'next/link'
import type { LibraryReadAccessKind } from '@/features/library/public'

/**
 * Vista cuando el viewer abre un item de una categoría con read access
 * restringido y NO está en el scope (G.5+6 ADR `2026-05-04`).
 *
 * Server Component puro. La page lo renderiza en lugar del item detalle
 * cuando `canReadItem === false`. Mensaje sobrio, sin pánico ni shame —
 * el viewer simplemente no tiene acceso, le ofrecemos volver a la zona.
 *
 * El copy varía levemente según el discriminator del read access:
 * GROUPS / TIERS / USERS — sin embargo el mensaje base es el mismo
 * (transparencia + invitación a volver), sólo el sub-texto cambia.
 */
type Props = {
  /** Discriminator del scope de la categoría — para sub-copy contextual. */
  readAccessKind: LibraryReadAccessKind
}

const SUBCOPY: Record<LibraryReadAccessKind, string> = {
  PUBLIC: 'Este contenido está restringido.',
  GROUPS: 'Este contenido está disponible para miembros de ciertos grupos.',
  TIERS: 'Este contenido está disponible para miembros con un tier específico.',
  USERS: 'Este contenido está disponible para personas designadas.',
}

export function ItemAccessDeniedView({ readAccessKind }: Props): React.ReactNode {
  const subcopy = SUBCOPY[readAccessKind]
  return (
    <div className="mx-3 my-8 rounded-[18px] border-[0.5px] border-border bg-surface px-6 py-10 text-center">
      <span
        aria-hidden="true"
        className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-soft text-neutral-500"
      >
        <svg
          className="h-6 w-6"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </span>
      <h2 className="font-serif text-lg text-text">No tenés acceso a este contenido</h2>
      <p className="mt-2 font-body text-sm text-muted">{subcopy}</p>
      <Link
        href="/library"
        className="mt-6 inline-block rounded-full bg-text px-4 py-2 text-sm font-medium text-bg hover:opacity-90"
      >
        Volver a Biblioteca
      </Link>
    </div>
  )
}
