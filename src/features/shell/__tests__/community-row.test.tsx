import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { CommunityRow } from '../ui/community-row'

afterEach(() => {
  cleanup()
})

const basePlace = {
  id: 'p1',
  slug: 'the-company',
  name: 'The Company',
  description: null,
  billingMode: 'OWNER_PAYS' as const,
  archivedAt: null,
  createdAt: new Date('2026-01-01'),
  role: 'MEMBER' as const,
  isOwner: false,
  joinedAt: new Date('2026-01-15'),
}

describe('CommunityRow', () => {
  it('renderiza nombre + initial del avatar', () => {
    const onSelect = vi.fn()
    render(<CommunityRow place={basePlace} isCurrent={false} onSelect={onSelect} />)
    expect(screen.getByText('The Company')).toBeInTheDocument()
    expect(screen.getByText('T')).toBeInTheDocument() // initial
  })

  it('rol "Miembro" cuando role=MEMBER e isOwner=false', () => {
    render(<CommunityRow place={basePlace} isCurrent={false} onSelect={vi.fn()} />)
    expect(screen.getByText('Miembro')).toBeInTheDocument()
  })

  it('rol "Admin" cuando role=ADMIN', () => {
    render(
      <CommunityRow place={{ ...basePlace, role: 'ADMIN' }} isCurrent={false} onSelect={vi.fn()} />,
    )
    expect(screen.getByText('Admin')).toBeInTheDocument()
  })

  it('rol "Owner" cuando isOwner=true (override role)', () => {
    render(
      <CommunityRow
        place={{ ...basePlace, role: 'ADMIN', isOwner: true }}
        isCurrent={false}
        onSelect={vi.fn()}
      />,
    )
    expect(screen.getByText('Owner')).toBeInTheDocument()
  })

  it('isCurrent=true agrega aria-current="true" + bg-accent-soft + check', () => {
    const { container } = render(<CommunityRow place={basePlace} isCurrent onSelect={vi.fn()} />)
    const button = container.querySelector('button[role="menuitem"]') as HTMLElement
    expect(button.getAttribute('aria-current')).toBe('true')
    expect(button.className).toContain('bg-accent-soft')
    // El check es un span aria-hidden con icon Check inside
    expect(container.querySelectorAll('svg')).toHaveLength(1)
  })

  it('isCurrent=false: sin aria-current, sin check icon', () => {
    const { container } = render(
      <CommunityRow place={basePlace} isCurrent={false} onSelect={vi.fn()} />,
    )
    const button = container.querySelector('button[role="menuitem"]') as HTMLElement
    expect(button.getAttribute('aria-current')).toBeNull()
    expect(container.querySelectorAll('svg')).toHaveLength(0)
  })

  it('click dispara onSelect con el slug', () => {
    const onSelect = vi.fn()
    render(<CommunityRow place={basePlace} isCurrent={false} onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('menuitem'))
    expect(onSelect).toHaveBeenCalledWith('the-company')
  })

  it('initial fallback "?" cuando nombre vacío', () => {
    render(
      <CommunityRow place={{ ...basePlace, name: '   ' }} isCurrent={false} onSelect={vi.fn()} />,
    )
    expect(screen.getByText('?')).toBeInTheDocument()
  })
})
