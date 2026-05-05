import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

const { pushMock, toastMock } = vi.hoisted(() => {
  const toast = vi.fn() as ReturnType<typeof vi.fn> & {
    success: ReturnType<typeof vi.fn>
    error: ReturnType<typeof vi.fn>
    info: ReturnType<typeof vi.fn>
  }
  toast.success = vi.fn()
  toast.error = vi.fn()
  toast.info = vi.fn()
  return { pushMock: vi.fn(), toastMock: toast }
})

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}))

vi.mock('@/shared/ui/toaster', () => ({
  toast: toastMock,
}))

import { LibraryItemLockedRow } from '../ui/library-item-locked-row'
import type { LibraryItemListView } from '@/features/library/public'

afterEach(() => {
  cleanup()
  pushMock.mockReset()
  toastMock.mockReset()
})

const baseItem: LibraryItemListView = {
  id: 'item-2',
  postId: 'post-2',
  postSlug: 'leccion-2',
  categorySlug: 'curso',
  categoryEmoji: '🎓',
  categoryTitle: 'Curso',
  title: 'Lección 2',
  coverUrl: null,
  authorUserId: 'user-1',
  authorDisplayName: 'Maxi',
  lastActivityAt: new Date('2026-05-04'),
  commentCount: 0,
  prereqItemId: 'item-1',
}

const prereq = {
  title: 'Lección 1',
  categorySlug: 'curso',
  postSlug: 'leccion-1',
}

describe('LibraryItemLockedRow', () => {
  it('renderiza título + badge candado + meta', () => {
    render(<LibraryItemLockedRow item={baseItem} prereq={prereq} />)
    expect(screen.getByText('Lección 2')).toBeInTheDocument()
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Completá "Lección 1" primero')
    expect(screen.getByText('Curso')).toBeInTheDocument()
  })

  it('aria-label del button incluye el contexto de bloqueo', () => {
    render(<LibraryItemLockedRow item={baseItem} prereq={prereq} />)
    const btn = screen.getByRole('button')
    expect(btn.getAttribute('aria-label')).toContain('bloqueado')
    expect(btn.getAttribute('aria-label')).toContain('Lección 1')
  })

  it('click dispara toast con action que navega al prereq', () => {
    render(<LibraryItemLockedRow item={baseItem} prereq={prereq} />)
    fireEvent.click(screen.getByRole('button'))

    expect(toastMock).toHaveBeenCalledTimes(1)
    const [message, options] = toastMock.mock.calls[0] as [
      string,
      { action: { onClick: () => void; label: string } },
    ]
    expect(message).toContain('Lección 1')
    expect(options.action.label).toContain('Lección 1')

    options.action.onClick()
    expect(pushMock).toHaveBeenCalledWith('/library/curso/leccion-1')
  })

  it('click NO navega directo (intercepta default)', () => {
    render(<LibraryItemLockedRow item={baseItem} prereq={prereq} />)
    fireEvent.click(screen.getByRole('button'))
    expect(pushMock).not.toHaveBeenCalled()
  })
})
