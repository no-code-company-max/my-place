import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const { setItemPrereqMock, toastSuccess, toastError } = vi.hoisted(() => ({
  setItemPrereqMock: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('@/features/library/courses/public', () => ({
  setItemPrereqAction: setItemPrereqMock,
}))

vi.mock('@/shared/ui/toaster', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}))

import { PrereqSelector } from '../ui/prereq-selector'

afterEach(() => cleanup())
beforeEach(() => {
  setItemPrereqMock.mockReset()
  toastSuccess.mockReset()
  toastError.mockReset()
})

const items = [
  { id: 'item-1', title: 'Lección 1' },
  { id: 'item-2', title: 'Lección 2' },
]

describe('PrereqSelector', () => {
  it('disabled cuando no hay items disponibles + muestra hint', () => {
    render(<PrereqSelector itemId="item-3" availableItems={[]} currentPrereqId={null} />)
    expect(screen.getByRole('combobox')).toBeDisabled()
    expect(screen.getByText(/no tiene otros items todavía/i)).toBeInTheDocument()
  })

  it('opción default "Sin prereq" presente + lista los items', () => {
    render(<PrereqSelector itemId="item-3" availableItems={items} currentPrereqId={null} />)
    expect(screen.getByText(/Sin prereq/)).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Lección 1' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Lección 2' })).toBeInTheDocument()
  })

  it('seleccionar prereq llama action y muestra toast success', async () => {
    setItemPrereqMock.mockResolvedValue({ ok: true })
    render(<PrereqSelector itemId="item-3" availableItems={items} currentPrereqId={null} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'item-1' } })
    await waitFor(() => {
      expect(setItemPrereqMock).toHaveBeenCalledWith({
        itemId: 'item-3',
        prereqItemId: 'item-1',
      })
      expect(toastSuccess).toHaveBeenCalledWith('Prereq actualizado.')
    })
  })

  it('limpiar prereq (value vacío) → action con prereqItemId=null + toast "Prereq removido"', async () => {
    setItemPrereqMock.mockResolvedValue({ ok: true })
    render(<PrereqSelector itemId="item-3" availableItems={items} currentPrereqId="item-1" />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '' } })
    await waitFor(() => {
      expect(setItemPrereqMock).toHaveBeenCalledWith({
        itemId: 'item-3',
        prereqItemId: null,
      })
      expect(toastSuccess).toHaveBeenCalledWith('Prereq removido.')
    })
  })

  it('cycle_detected → toast.error con copy específico + revierte selección', async () => {
    setItemPrereqMock.mockResolvedValue({ ok: false, error: 'cycle_detected' })
    render(<PrereqSelector itemId="item-3" availableItems={items} currentPrereqId={null} />)
    const select = screen.getByRole('combobox') as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'item-2' } })
    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(expect.stringContaining('ciclo'))
      expect(select.value).toBe('')
    })
  })

  it('throw inesperado → toast.error genérico + revierte', async () => {
    setItemPrereqMock.mockRejectedValue(new Error('boom'))
    render(<PrereqSelector itemId="item-3" availableItems={items} currentPrereqId={null} />)
    const select = screen.getByRole('combobox') as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'item-1' } })
    await waitFor(() => {
      expect(toastError).toHaveBeenCalled()
      expect(select.value).toBe('')
    })
  })
})
