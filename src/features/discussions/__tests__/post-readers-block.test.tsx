import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

// Next.js Link se mockea a un <a> simple para poder asercionar props en el DOM.
vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    prefetch,
    ...rest
  }: {
    children: React.ReactNode
    href: string
    prefetch?: boolean
  } & Record<string, unknown>) => (
    <a href={href} data-prefetch={String(prefetch)} {...rest}>
      {children}
    </a>
  ),
}))

import { PostReadersBlock } from '../ui/post-readers-block'

// Shape mínimo del PostReader. El tipo canónico vive en
// `../server/queries` pero importarlo arrastra el chain de Prisma+env
// al test runtime. Acá replicamos el shape (es estable, sin métodos).
type PostReader = {
  userId: string
  displayName: string
  avatarUrl: string | null
  readAt: Date
}

function makeReader(
  overrides: Partial<{
    userId: string
    displayName: string
    avatarUrl: string | null
    readAt: Date
  }> = {},
): PostReader {
  return {
    userId: overrides.userId ?? 'u-1',
    displayName: overrides.displayName ?? 'Max',
    avatarUrl: overrides.avatarUrl ?? null,
    readAt: overrides.readAt ?? new Date('2026-04-22T20:00:00Z'),
  }
}

function renderBlock(readers: PostReader[]) {
  return render(<PostReadersBlock readers={readers} />)
}

describe('PostReadersBlock (pure component)', () => {
  afterEach(() => {
    cleanup()
  })

  it('retorna null cuando readers es vacío (place unconfigured o sin lectores)', () => {
    const { container } = renderBlock([])
    expect(container).toBeEmptyDOMElement()
  })

  it('rendea lista con avatares hasta 8 + overflow "+N más"', () => {
    const readers = Array.from({ length: 10 }).map((_, i) =>
      makeReader({ userId: `u-${i}`, displayName: `User ${i}` }),
    )
    renderBlock(readers)

    const list = screen.getByLabelText('Lectores de la apertura')
    expect(list).toBeInTheDocument()
    // 8 visibles + overflow "+2 más"
    const links = list.querySelectorAll('a')
    expect(links).toHaveLength(8)
    expect(screen.getByText('+2 más')).toBeInTheDocument()
  })

  it('sin overflow cuando hay ≤8 lectores', () => {
    renderBlock([
      makeReader({ userId: 'u-1', displayName: 'Max' }),
      makeReader({ userId: 'u-2', displayName: 'Lucía' }),
    ])

    expect(screen.queryByText(/\+\d+ más/)).not.toBeInTheDocument()
  })

  it('cada lector es link a /m/<userId> con prefetch=false y aria-label', () => {
    renderBlock([makeReader({ userId: 'u-abc', displayName: 'Lucía' })])

    const link = screen.getByRole('link', { name: 'Lucía' })
    expect(link).toHaveAttribute('href', '/m/u-abc')
    expect(link).toHaveAttribute('data-prefetch', 'false')
  })

  it('avatar con URL: <img> con alt + title = displayName', () => {
    renderBlock([
      makeReader({
        userId: 'u-1',
        displayName: 'Max',
        avatarUrl: 'https://cdn/a.png',
      }),
    ])

    const img = screen.getByAltText('Max') as HTMLImageElement
    expect(img.src).toBe('https://cdn/a.png')
    expect(img.title).toBe('Max')
  })

  it('avatar sin URL: inicial del displayName', () => {
    renderBlock([makeReader({ userId: 'u-1', displayName: 'lucía', avatarUrl: null })])

    expect(screen.getByText('L')).toBeInTheDocument()
  })

  it('label visible "Leyeron:" junto a los avatares', () => {
    renderBlock([makeReader()])

    expect(screen.getByText('Leyeron:')).toBeInTheDocument()
  })
})
