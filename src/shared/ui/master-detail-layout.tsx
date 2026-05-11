import type { ReactNode } from 'react'

/**
 * Layout responsive master-detail (lista + detalle).
 *
 * - **Mobile**: stack navigation. Solo un pane visible a la vez según `hasDetail`:
 *   - `hasDetail=false` (default) → master full-width, detail oculto.
 *   - `hasDetail=true` → master oculto, detail full-width (típicamente vía
 *     route push a una page detail, NO inline).
 * - **Desktop (`md:`)**: split view 2 columnas. Master fijo 360px a la
 *   izquierda con `border-r`, detail toma el resto (`1fr`). Ambos siempre
 *   visibles.
 *
 * **Sin `useMediaQuery`**: visibilidad de panes mobile vs desktop es
 * CSS-driven (`hidden md:block`). El `hasDetail` solo discrimina mobile;
 * en desktop ambos panes están siempre visibles.
 *
 * **Cuándo usar**: lista de items administrables donde cada item tiene
 * un detail page (`/settings/members/[userId]`, `/settings/groups/[groupId]`,
 * `/settings/library/[categoryId]`). En desktop el split mantiene la lista
 * visible mientras editás un item (Linear, Stripe, Notion patterns —
 * iOS Mail original).
 *
 * **Cuándo NO usar**: pages tipo form único (hours, access, editor) — un
 * single-column form max-w-screen-md es más limpio.
 *
 * Uso típico con Next 15 Parallel Routes:
 * ```tsx
 * // settings/members/layout.tsx
 * <MasterDetailLayout master={children} detail={detail} hasDetail={hasUserId} />
 * ```
 *
 * Ver `docs/research/2026-05-10-settings-desktop-ux-research.md` § 4.
 */

type Props = {
  master: ReactNode
  detail: ReactNode
  /**
   * En mobile, indica si hay un detail seleccionado (típicamente derivado
   * del URL: `/settings/groups/[groupId]` → `true`). Default `false`
   * (mobile muestra solo master).
   */
  hasDetail?: boolean
  masterLabel?: string
  detailLabel?: string
}

export function MasterDetailLayout({
  master,
  detail,
  hasDetail = false,
  masterLabel = 'Lista',
  detailLabel = 'Detalle',
}: Props): React.ReactNode {
  // Mobile: hide-show via CSS según hasDetail. Desktop: ambos siempre visibles.
  const masterClass = hasDetail
    ? 'hidden md:block md:border-r md:border-neutral-200'
    : 'block md:block md:border-r md:border-neutral-200'
  const detailClass = hasDetail ? 'block md:block' : 'hidden md:block'

  return (
    <div className="md:grid md:min-h-[calc(100vh-52px)] md:grid-cols-[360px_1fr]">
      <section data-pane="master" aria-label={masterLabel} className={masterClass}>
        {master}
      </section>
      <section data-pane="detail" aria-label={detailLabel} className={detailClass}>
        {detail}
      </section>
    </div>
  )
}
