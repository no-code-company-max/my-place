import Link from 'next/link'

/**
 * Header de la sección "Discusiones" en la lista (R.6).
 *
 * Composición (handoff threads/, ajustado a tipografía unificada de
 * zonas — home, conversaciones, eventos comparten el mismo H1 26/700/
 * Fraunces/-0.6):
 *  - Chip 56×56 con emoji 💬 (32px) centrado, `bg-surface` border-0.5px,
 *    radius 14.
 *  - Título "Discusiones" en `font-title text-[26px] font-bold
 *    tracking-[-0.6px]`.
 *  - CTA "Nueva conversación" como botón discreto a la extrema derecha
 *    (link a `/conversations/new`). Único punto de entrada para crear
 *    posts en F1 — no es FAB.
 *
 * Padding lateral 12px (`px-3`) consistente con el resto de zonas.
 *
 * Server Component: sin estado, sin queries propias.
 *
 * Ver `docs/features/discussions/spec.md` § 21.1.
 */
export function ThreadsSectionHeader(): React.ReactNode {
  return (
    <header className="flex items-center gap-[18px] px-3 pt-6">
      <span
        aria-hidden="true"
        className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-[14px] border-[0.5px] border-border bg-surface text-[32px] leading-none"
      >
        💬
      </span>
      <h1 className="flex-1 font-title text-[26px] font-bold tracking-[-0.6px] text-text">
        Discusiones
      </h1>
      <Link
        href="/conversations/new"
        className="shrink-0 rounded-[10px] border-[0.5px] border-border bg-surface px-3 py-2 font-body text-[13px] font-medium text-text hover:bg-soft motion-safe:transition-colors"
      >
        Nueva
      </Link>
    </header>
  )
}
