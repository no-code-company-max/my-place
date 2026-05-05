import type { ReactNode } from 'react'

/**
 * Badge presentational para items en categorías kind=COURSE con prereq
 * incompleto. Render: candado SVG + label invisible para a11y +
 * tooltip estático con el motivo.
 *
 * Server-safe (no hooks ni handlers). El consumer decide dónde
 * posicionarlo (típicamente al lado del título del item en el listing,
 * o como overlay sobre la fila).
 *
 * El click handler para disparar toast vive en el Client wrapper que
 * intercepta la navegación — `<LibraryItemLockedRow>`.
 *
 * Decisión #D2 ADR `2026-05-04-library-courses-and-read-access.md`:
 * sequential unlock se ve, no se oculta.
 */
type Props = {
  /** Título del item prereq que el viewer debe completar. */
  prereqTitle: string
  /** Padding interno opcional para integrar dentro de filas con su
   *  propio spacing. Default `0` (sólo el SVG + sr-only label). */
  className?: string
}

export function PrereqLockBadge({ prereqTitle, className }: Props): ReactNode {
  const tooltip = `Completá "${prereqTitle}" primero`
  return (
    <span
      role="img"
      aria-label={tooltip}
      title={tooltip}
      className={`inline-flex items-center justify-center text-neutral-500 ${className ?? ''}`}
    >
      <svg
        aria-hidden="true"
        className="h-4 w-4"
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
  )
}
