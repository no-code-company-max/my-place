import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

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

import { ItemAccessDeniedView } from '../ui/item-access-denied-view'

afterEach(() => cleanup())

describe('ItemAccessDeniedView', () => {
  it('mensaje principal + CTA "Volver a Biblioteca" siempre presentes', () => {
    render(<ItemAccessDeniedView readAccessKind="GROUPS" />)
    expect(screen.getByRole('heading', { name: /no tenés acceso/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /volver a biblioteca/i })).toHaveAttribute(
      'href',
      '/library',
    )
  })

  it('sub-copy varía por discriminator GROUPS', () => {
    render(<ItemAccessDeniedView readAccessKind="GROUPS" />)
    expect(screen.getByText(/grupos/i)).toBeInTheDocument()
  })

  it('sub-copy varía por discriminator TIERS', () => {
    render(<ItemAccessDeniedView readAccessKind="TIERS" />)
    expect(screen.getByText(/tier/i)).toBeInTheDocument()
  })

  it('sub-copy varía por discriminator USERS', () => {
    render(<ItemAccessDeniedView readAccessKind="USERS" />)
    expect(screen.getByText(/personas designadas/i)).toBeInTheDocument()
  })
})
