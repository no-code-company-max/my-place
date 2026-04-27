import { PageIcon } from '@/shared/ui/page-icon'

/**
 * Header de la sección "Discusiones" en la lista (R.6).
 *
 * Composición unificada con home y eventos:
 *  - `<PageIcon>` 44×44 con emoji 💬 (specs en page-icon.tsx).
 *  - Título "Discusiones" en `font-title text-[26px] font-bold
 *    tracking-[-0.6px]`.
 *
 * El CTA "Nueva conversación" se removió en R.2.6.2 — el único punto
 * de entrada para crear ahora es el FAB cross-zona montado en el
 * shell. Ver `docs/features/shell/spec.md` § 17 + ADR
 * `docs/decisions/2026-04-26-zone-fab.md`.
 *
 * Padding lateral 12px (`px-3`) consistente con el resto de zonas.
 *
 * Server Component: sin estado, sin queries propias.
 *
 * Ver `docs/features/discussions/spec.md` § 21.1.
 */
export function ThreadsSectionHeader(): React.ReactNode {
  return (
    <header className="flex items-center gap-3 px-3 pt-6">
      <PageIcon emoji="💬" />
      <h1 className="flex-1 font-title text-[26px] font-bold tracking-[-0.6px] text-text">
        Discusiones
      </h1>
    </header>
  )
}
