import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { ReactionBar } from '../ui/reaction-bar'
import type { AggregatedReaction } from '../server/reactions-aggregation'

// Server Actions del slice — mockeadas para evitar boundaries server-only
// y porque estos tests sólo verifican el render, no la mutación.
vi.mock('../server/actions/reactions', () => ({
  reactAction: vi.fn(async () => undefined),
  unreactAction: vi.fn(async () => undefined),
}))

afterEach(() => cleanup())

function reactionsWith(
  overrides: Partial<Record<AggregatedReaction['emoji'], number>> = {},
): AggregatedReaction[] {
  return Object.entries(overrides).map(([emoji, count]) => ({
    emoji: emoji as AggregatedReaction['emoji'],
    count,
    viewerReacted: false,
  }))
}

describe('ReactionBar — Audit #4: ocultar count cuando es 0', () => {
  it('count === 0 (sin reacciones) → el span del numerito queda vacío', () => {
    const { container } = render(<ReactionBar targetType="POST" targetId="post-1" initial={[]} />)
    // 6 emojis configurados → 6 buttons.
    const buttons = container.querySelectorAll('button')
    expect(buttons.length).toBe(6)
    for (const btn of buttons) {
      const numSpan = btn.querySelector('.tabular-nums')
      // El span existe (reserva el ancho con min-w-[1ch] → no layout shift
      // cuando el count salta de 0 a N), pero su textContent es vacío.
      expect(numSpan).not.toBeNull()
      expect(numSpan?.textContent).toBe('')
    }
  })

  it('count > 0 → el span muestra el número', () => {
    const { container } = render(
      <ReactionBar
        targetType="POST"
        targetId="post-1"
        initial={reactionsWith({ THUMBS_UP: 3, HEART: 1 })}
      />,
    )
    const buttons = Array.from(container.querySelectorAll('button'))
    const thumbs = buttons.find((b) => b.getAttribute('aria-label')?.includes('pulgar'))
    const heart = buttons.find((b) => b.getAttribute('aria-label')?.includes('corazón'))
    const cry = buttons.find((b) => b.getAttribute('aria-label')?.includes('tristeza'))

    expect(thumbs?.querySelector('.tabular-nums')?.textContent).toBe('3')
    expect(heart?.querySelector('.tabular-nums')?.textContent).toBe('1')
    // Los emojis no presentes en `initial` quedan en 0 → vacíos.
    expect(cry?.querySelector('.tabular-nums')?.textContent).toBe('')
  })

  it('estructura preserva min-w-[1ch] en TODOS los buttons (no layout shift)', () => {
    const { container } = render(
      <ReactionBar targetType="COMMENT" targetId="c-1" initial={reactionsWith({ THUMBS_UP: 5 })} />,
    )
    const numSpans = container.querySelectorAll('.tabular-nums')
    expect(numSpans.length).toBe(6)
    for (const span of numSpans) {
      expect(span.className).toContain('min-w-[1ch]')
    }
  })
})
