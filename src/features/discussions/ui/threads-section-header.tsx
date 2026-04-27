import Link from 'next/link'
import { PageIcon } from '@/shared/ui/page-icon'

/**
 * Header de la sección "Discusiones" en la lista (R.6).
 *
 * Composición unificada con home y eventos:
 *  - `<PageIcon>` 44×44 con emoji 💬 (specs en page-icon.tsx).
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
    <header className="flex items-center gap-3 px-3 pt-6">
      <PageIcon emoji="💬" />
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
