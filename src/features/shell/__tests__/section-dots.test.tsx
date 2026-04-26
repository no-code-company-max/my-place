import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

const usePathnameMock = vi.fn()
vi.mock('next/navigation', () => ({
  usePathname: () => usePathnameMock(),
}))

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode
    href: string
  } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

import { SectionDots } from '../ui/section-dots'

afterEach(() => {
  cleanup()
  usePathnameMock.mockReset()
})

describe('SectionDots', () => {
  it('renderiza 3 dots con aria-label de cada zona', () => {
    usePathnameMock.mockReturnValue('/')
    render(<SectionDots />)
    expect(screen.getByLabelText('Ir a Inicio')).toBeInTheDocument()
    expect(screen.getByLabelText('Ir a Conversaciones')).toBeInTheDocument()
    expect(screen.getByLabelText('Ir a Eventos')).toBeInTheDocument()
  })

  it('"/" marca el dot de Inicio como aria-current="page"', () => {
    usePathnameMock.mockReturnValue('/')
    render(<SectionDots />)
    expect(screen.getByLabelText('Ir a Inicio')).toHaveAttribute('aria-current', 'page')
    expect(screen.getByLabelText('Ir a Conversaciones')).not.toHaveAttribute('aria-current')
  })

  it('"/conversations/[slug]" marca Conversaciones como current', () => {
    usePathnameMock.mockReturnValue('/conversations/algun-slug')
    render(<SectionDots />)
    expect(screen.getByLabelText('Ir a Conversaciones')).toHaveAttribute('aria-current', 'page')
    expect(screen.getByLabelText('Ir a Inicio')).not.toHaveAttribute('aria-current')
  })

  it('"/settings" no marca ningún dot como current', () => {
    usePathnameMock.mockReturnValue('/settings')
    render(<SectionDots />)
    expect(screen.queryByLabelText('Ir a Inicio')).not.toHaveAttribute('aria-current')
    expect(screen.queryByLabelText('Ir a Conversaciones')).not.toHaveAttribute('aria-current')
    expect(screen.queryByLabelText('Ir a Eventos')).not.toHaveAttribute('aria-current')
  })

  it('disabled=true agrega clase pointer-events-none + opacity-50', () => {
    usePathnameMock.mockReturnValue('/')
    const { container } = render(<SectionDots disabled />)
    const nav = container.querySelector('nav')
    expect(nav?.className).toContain('pointer-events-none')
    expect(nav?.className).toContain('opacity-50')
  })

  it('cada link apunta al path canónico de su zona', () => {
    usePathnameMock.mockReturnValue('/')
    render(<SectionDots />)
    expect(screen.getByLabelText('Ir a Inicio')).toHaveAttribute('href', '/')
    expect(screen.getByLabelText('Ir a Conversaciones')).toHaveAttribute('href', '/conversations')
    expect(screen.getByLabelText('Ir a Eventos')).toHaveAttribute('href', '/events')
  })
})
