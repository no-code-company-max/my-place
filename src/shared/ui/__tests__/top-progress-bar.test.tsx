import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { TopProgressBar } from '../top-progress-bar'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  cleanup()
})

describe('TopProgressBar', () => {
  it('inicia oculto (opacity-0) cuando isPending=false', () => {
    const { container } = render(<TopProgressBar isPending={false} />)
    const bar = container.firstChild as HTMLElement
    expect(bar.className).toContain('opacity-0')
  })

  it('NO aparece inmediatamente cuando isPending=true (anti-flicker)', () => {
    const { container } = render(<TopProgressBar isPending={true} delayMs={200} />)
    const bar = container.firstChild as HTMLElement
    expect(bar.className).toContain('opacity-0')
  })

  it('aparece tras delayMs si isPending sigue true', () => {
    const { container } = render(<TopProgressBar isPending={true} delayMs={200} />)
    const bar = container.firstChild as HTMLElement
    expect(bar.className).toContain('opacity-0')

    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(bar.className).toContain('opacity-100')
  })

  it('NO aparece si isPending pasa a false antes del delay (transition rápida)', () => {
    const { container, rerender } = render(<TopProgressBar isPending={true} delayMs={200} />)
    const bar = container.firstChild as HTMLElement

    // 100ms — aún dentro del delay window
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(bar.className).toContain('opacity-0')

    // isPending pasa a false antes de los 200ms
    rerender(<TopProgressBar isPending={false} delayMs={200} />)
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(bar.className).toContain('opacity-0')
  })

  it('fade-out cuando isPending pasa a false después de aparecer', () => {
    const { container, rerender } = render(<TopProgressBar isPending={true} delayMs={200} />)
    const bar = container.firstChild as HTMLElement

    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(bar.className).toContain('opacity-100')

    rerender(<TopProgressBar isPending={false} delayMs={200} />)
    expect(bar.className).toContain('opacity-0')
  })

  it('aria-hidden true (no es info accesible importante, pure visual cue)', () => {
    const { container } = render(<TopProgressBar isPending={true} />)
    const bar = container.firstChild as HTMLElement
    expect(bar.getAttribute('aria-hidden')).toBe('true')
  })

  it('default delayMs = 200ms', () => {
    const { container } = render(<TopProgressBar isPending={true} />)
    const bar = container.firstChild as HTMLElement

    act(() => {
      vi.advanceTimersByTime(199)
    })
    expect(bar.className).toContain('opacity-0')

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(bar.className).toContain('opacity-100')
  })
})
