import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const { markActionMock, unmarkActionMock, toastSuccess, toastError } = vi.hoisted(() => ({
  markActionMock: vi.fn(),
  unmarkActionMock: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('@/features/library/courses/public', () => ({
  markItemCompletedAction: markActionMock,
  unmarkItemCompletedAction: unmarkActionMock,
}))

vi.mock('@/shared/ui/toaster', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}))

import { MarkCompleteButton } from '../ui/mark-complete-button'

afterEach(() => cleanup())
beforeEach(() => {
  markActionMock.mockReset()
  unmarkActionMock.mockReset()
  toastSuccess.mockReset()
  toastError.mockReset()
})

describe('MarkCompleteButton', () => {
  it('estado inicial completed=false → botón "Marcar como completado", aria-pressed false', () => {
    render(<MarkCompleteButton itemId="item-1" completed={false} />)
    const btn = screen.getByRole('button')
    expect(btn).toHaveAttribute('aria-pressed', 'false')
    expect(btn.textContent).toContain('Marcar')
  })

  it('estado inicial completed=true → "Completado · Desmarcar", aria-pressed true', () => {
    render(<MarkCompleteButton itemId="item-1" completed={true} />)
    const btn = screen.getByRole('button')
    expect(btn).toHaveAttribute('aria-pressed', 'true')
    expect(btn.textContent).toContain('Completado')
  })

  it('click en completed=false llama markItemCompletedAction y muestra toast success', async () => {
    markActionMock.mockResolvedValue({ ok: true, alreadyCompleted: false })
    render(<MarkCompleteButton itemId="item-1" completed={false} />)
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => {
      expect(markActionMock).toHaveBeenCalledWith({ itemId: 'item-1' })
      expect(toastSuccess).toHaveBeenCalledWith('Marcado como completado.')
    })
  })

  it('mark idempotente alreadyCompleted=true → toast "Ya estaba marcado"', async () => {
    markActionMock.mockResolvedValue({ ok: true, alreadyCompleted: true })
    render(<MarkCompleteButton itemId="item-1" completed={false} />)
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith('Ya estaba marcado.')
    })
  })

  it('click en completed=true llama unmarkItemCompletedAction y muestra "Marca removida"', async () => {
    unmarkActionMock.mockResolvedValue({ ok: true })
    render(<MarkCompleteButton itemId="item-1" completed={true} />)
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => {
      expect(unmarkActionMock).toHaveBeenCalledWith({ itemId: 'item-1' })
      expect(toastSuccess).toHaveBeenCalledWith('Marca removida.')
    })
  })

  it('error en server action → toast.error', async () => {
    markActionMock.mockRejectedValue(new Error('boom'))
    render(<MarkCompleteButton itemId="item-1" completed={false} />)
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => {
      expect(toastError).toHaveBeenCalled()
    })
  })
})
