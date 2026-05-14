import Link from 'next/link'

/**
 * Paginación prev/next compartida entre tabs activos e invitados de
 * `/settings/members`. Server-safe — recibe `prevHref` y `nextHref`
 * precomputados por el caller (Server Component o Client orchestrator) y
 * solo renderiza los links.
 *
 * Mostrar/ocultar: si `totalPages <= 1` o ambos hrefs son `null`, no se
 * renderiza nada (el caller puede chequear `hasMore || page > 1` antes
 * también, pero acá manejamos el caso defensivamente).
 *
 * Sin números intermedios — para 150 miembros con limit 20 son máximo
 * 8 páginas, prev/next basta. Si emergen casos con > 50 páginas, sumar
 * page numbers entonces (no V1).
 */
type Props = {
  page: number
  totalCount: number
  pageSize: number
  prevHref: string | null
  nextHref: string | null
  itemLabel: { singular: string; plural: string }
}

export function MembersPagination({
  page,
  totalCount,
  pageSize,
  prevHref,
  nextHref,
  itemLabel,
}: Props): React.ReactNode {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  if (totalPages <= 1 && !prevHref && !nextHref) return null

  const linkClass =
    'inline-flex min-h-11 items-center justify-center rounded-md border border-neutral-300 px-3 text-sm hover:bg-neutral-50'
  const disabledClass =
    'inline-flex min-h-11 cursor-not-allowed items-center justify-center rounded-md border border-neutral-200 px-3 text-sm text-neutral-400'

  return (
    <nav
      aria-label="Paginación"
      className="flex items-center justify-between gap-3 pt-2 text-sm text-neutral-600"
    >
      <span aria-live="polite">
        {totalCount} {totalCount === 1 ? itemLabel.singular : itemLabel.plural}
        {totalPages > 1 ? (
          <>
            <span aria-hidden className="mx-1.5">
              ·
            </span>
            <span>
              página {page} de {totalPages}
            </span>
          </>
        ) : null}
      </span>
      <span className="flex items-center gap-2">
        {prevHref ? (
          <Link href={prevHref} className={linkClass} aria-label="Página anterior">
            ← Anterior
          </Link>
        ) : (
          <span className={disabledClass} aria-disabled="true">
            ← Anterior
          </span>
        )}
        {nextHref ? (
          <Link href={nextHref} className={linkClass} aria-label="Página siguiente">
            Siguiente →
          </Link>
        ) : (
          <span className={disabledClass} aria-disabled="true">
            Siguiente →
          </span>
        )}
      </span>
    </nav>
  )
}
