import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { PrereqLockBadge } from '../ui/prereq-lock-badge'

afterEach(() => cleanup())

describe('PrereqLockBadge', () => {
  it('expone tooltip + aria-label con el título del prereq', () => {
    render(<PrereqLockBadge prereqTitle="Lección 1" />)
    const badge = screen.getByRole('img')
    expect(badge).toHaveAttribute('aria-label', 'Completá "Lección 1" primero')
    expect(badge).toHaveAttribute('title', 'Completá "Lección 1" primero')
  })

  it('respeta `className` opcional al lado de las clases base', () => {
    const { container } = render(<PrereqLockBadge prereqTitle="X" className="custom-class" />)
    const span = container.querySelector('span')
    expect(span?.className).toContain('custom-class')
    expect(span?.className).toContain('inline-flex')
  })

  it('renderiza un SVG como ícono interno', () => {
    const { container } = render(<PrereqLockBadge prereqTitle="X" />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })
})
