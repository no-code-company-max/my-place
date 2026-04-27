/**
 * "Page icon" — chip cuadrado 44×44 con emoji centrado, usado en los
 * headers de las zonas del producto (Inicio, Conversaciones, Eventos)
 * para identificar la zona visualmente al lado del título.
 *
 * Specs exactos (acordados con el user):
 *  - 44×44 px, border-radius 12, bg-surface, border 0.5px border.
 *  - Sombra dual sutil: 0 4px 14px rgba(0,0,0,0.06) + 0 1px 2px
 *    rgba(0,0,0,0.04). Define profundidad sin "gritar".
 *  - Emoji 24px, line-height 1 (sin padding vertical extra del glyph).
 *
 * Server Component puro. Emoji decorativo (`aria-hidden`) — el título
 * adyacente comunica la zona al lector de pantalla.
 */
type Props = {
  emoji: string
  className?: string
}

const SHADOW = '0 4px 14px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)'

export function PageIcon({ emoji, className }: Props): React.ReactNode {
  return (
    <span
      aria-hidden="true"
      style={{ boxShadow: SHADOW, lineHeight: 1 }}
      className={[
        'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] border-[0.5px] border-border bg-surface text-[24px]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {emoji}
    </span>
  )
}
