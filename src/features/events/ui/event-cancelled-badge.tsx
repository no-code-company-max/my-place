/**
 * Badge "Cancelado" — compactado, sin grito visual. Lo renderiza tanto el
 * detail del evento como el list-item y el header del thread asociado
 * (vía relación inversa `Post.event`).
 *
 * Server Component puro — sin `'use client'`.
 *
 * Ver `docs/features/events/spec.md § 10` (copy).
 */
export function EventCancelledBadge(): React.ReactNode {
  return (
    <span
      className="inline-flex items-center rounded border border-place-divider bg-place-card px-2 py-0.5 text-xs italic text-place-text-soft"
      aria-label="Evento cancelado"
    >
      Cancelado
    </span>
  )
}
