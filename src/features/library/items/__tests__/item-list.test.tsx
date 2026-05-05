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

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/shared/ui/toaster', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}))

vi.mock('@/shared/config/env', () => ({
  clientEnv: {
    NEXT_PUBLIC_APP_URL: 'http://lvh.me:3000',
    NEXT_PUBLIC_APP_DOMAIN: 'lvh.me:3000',
    NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
  },
  serverEnv: { SUPABASE_SERVICE_ROLE_KEY: 'service', NODE_ENV: 'test' },
}))

import { ItemList } from '../ui/item-list'
import type { LibraryItemListView } from '@/features/library/public'

afterEach(() => cleanup())

const baseItem: LibraryItemListView = {
  id: 'item-1',
  postId: 'post-1',
  postSlug: 'leccion-1',
  categorySlug: 'curso',
  categoryEmoji: '🎓',
  categoryTitle: 'Curso',
  title: 'Lección 1',
  coverUrl: null,
  authorUserId: 'user-1',
  authorDisplayName: 'Maxi',
  lastActivityAt: new Date('2026-05-04'),
  commentCount: 0,
  prereqItemId: null,
}

describe('ItemList — locked rows (G.2+3.b)', () => {
  it('items sin prereqId se renderizan como link normal', () => {
    render(<ItemList items={[baseItem]} />)
    expect(screen.getByRole('link', { name: /Lección 1/ })).toHaveAttribute(
      'href',
      '/library/curso/leccion-1',
    )
  })

  it('item con prereq incompleto + lookup → renderiza locked row (button, no link)', () => {
    const lockedItem = { ...baseItem, id: 'item-2', title: 'Lección 2', prereqItemId: 'item-1' }
    const lookup = new Map([
      ['item-1', { title: 'Lección 1', categorySlug: 'curso', postSlug: 'leccion-1' }],
    ])
    render(<ItemList items={[lockedItem]} itemsLookup={lookup} completedItemIds={[]} />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('item con prereq YA completado → renderiza row normal (link)', () => {
    const item = { ...baseItem, id: 'item-2', title: 'Lección 2', prereqItemId: 'item-1' }
    const lookup = new Map([
      ['item-1', { title: 'Lección 1', categorySlug: 'curso', postSlug: 'leccion-1' }],
    ])
    render(<ItemList items={[item]} itemsLookup={lookup} completedItemIds={['item-1']} />)
    expect(screen.getByRole('link')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('viewerIsOwner=true bypassa lock incluso con prereq incompleto', () => {
    const item = { ...baseItem, id: 'item-2', title: 'Lección 2', prereqItemId: 'item-1' }
    const lookup = new Map([
      ['item-1', { title: 'Lección 1', categorySlug: 'curso', postSlug: 'leccion-1' }],
    ])
    render(
      <ItemList items={[item]} itemsLookup={lookup} completedItemIds={[]} viewerIsOwner={true} />,
    )
    expect(screen.getByRole('link')).toBeInTheDocument()
  })

  it('items vacío → null', () => {
    const { container } = render(<ItemList items={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
