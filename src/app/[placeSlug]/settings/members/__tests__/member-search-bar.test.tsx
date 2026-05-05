import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

const usePathnameMock = vi.fn()
const useSearchParamsMock = vi.fn()
const replaceMock = vi.fn()

vi.mock('next/navigation', () => ({
  usePathname: () => usePathnameMock(),
  useSearchParams: () => useSearchParamsMock(),
  useRouter: () => ({ replace: replaceMock }),
}))

import { MemberSearchBar } from '../components/member-search-bar'

beforeEach(() => {
  vi.useFakeTimers()
  usePathnameMock.mockReset()
  useSearchParamsMock.mockReset()
  replaceMock.mockReset()
  usePathnameMock.mockReturnValue('/settings/members')
})

afterEach(() => {
  vi.useRealTimers()
  cleanup()
})

function mockSearchParams(query: string): void {
  useSearchParamsMock.mockReturnValue(new URLSearchParams(query))
}

describe('MemberSearchBar (URL state + debounce)', () => {
  it('renderiza un input search vacío cuando no hay `?q=` en la URL', () => {
    mockSearchParams('')
    render(<MemberSearchBar />)
    const input = screen.getByPlaceholderText('Buscar por nombre o handle…') as HTMLInputElement
    expect(input.value).toBe('')
  })

  it('hidrata el input desde `?q=` de la URL', () => {
    mockSearchParams('q=ana')
    render(<MemberSearchBar />)
    const input = screen.getByPlaceholderText('Buscar por nombre o handle…') as HTMLInputElement
    expect(input.value).toBe('ana')
  })

  it('escribir en el input no dispara router.replace inmediatamente (debounce 300ms)', () => {
    mockSearchParams('')
    render(<MemberSearchBar />)
    const input = screen.getByPlaceholderText('Buscar por nombre o handle…')
    fireEvent.change(input, { target: { value: 'ana' } })
    // Sin avanzar timers: replace no se llamó.
    expect(replaceMock).not.toHaveBeenCalled()
  })

  it('después del debounce, dispara router.replace con `?q=...`', () => {
    mockSearchParams('')
    render(<MemberSearchBar />)
    const input = screen.getByPlaceholderText('Buscar por nombre o handle…')
    fireEvent.change(input, { target: { value: 'ana' } })
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(replaceMock).toHaveBeenCalledWith('/settings/members?q=ana', { scroll: false })
  })

  it('submit inmediato (Enter) dispara replace sin esperar debounce', () => {
    mockSearchParams('')
    render(<MemberSearchBar />)
    const input = screen.getByPlaceholderText('Buscar por nombre o handle…')
    fireEvent.change(input, { target: { value: 'ana' } })
    const form = input.closest('form')!
    fireEvent.submit(form)
    expect(replaceMock).toHaveBeenCalledWith('/settings/members?q=ana', { scroll: false })
  })

  it('vaciar el input borra `?q=` de la URL', () => {
    mockSearchParams('q=ana')
    render(<MemberSearchBar />)
    const input = screen.getByPlaceholderText('Buscar por nombre o handle…')
    fireEvent.change(input, { target: { value: '' } })
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(replaceMock).toHaveBeenCalledWith('/settings/members', { scroll: false })
  })

  it('preserva otros query params al actualizar `q`', () => {
    mockSearchParams('role=ADMIN&tierId=tier_123')
    render(<MemberSearchBar />)
    const input = screen.getByPlaceholderText('Buscar por nombre o handle…')
    fireEvent.change(input, { target: { value: 'ana' } })
    act(() => {
      vi.advanceTimersByTime(300)
    })
    const calledWith = replaceMock.mock.calls[0]?.[0] as string
    expect(calledWith).toMatch(/^\/settings\/members\?/)
    expect(calledWith).toMatch(/role=ADMIN/)
    expect(calledWith).toMatch(/tierId=tier_123/)
    expect(calledWith).toMatch(/q=ana/)
  })

  it('debounce coalesce keystrokes consecutivos en una sola navegación', () => {
    mockSearchParams('')
    render(<MemberSearchBar />)
    const input = screen.getByPlaceholderText('Buscar por nombre o handle…')
    fireEvent.change(input, { target: { value: 'a' } })
    fireEvent.change(input, { target: { value: 'an' } })
    fireEvent.change(input, { target: { value: 'ana' } })
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(replaceMock).toHaveBeenCalledTimes(1)
    expect(replaceMock).toHaveBeenCalledWith('/settings/members?q=ana', { scroll: false })
  })

  it('no dispara replace si el value debounced coincide con el último pushed', () => {
    mockSearchParams('q=ana')
    render(<MemberSearchBar />)
    const input = screen.getByPlaceholderText('Buscar por nombre o handle…')
    // Re-tipear el mismo valor.
    fireEvent.change(input, { target: { value: 'ana' } })
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(replaceMock).not.toHaveBeenCalled()
  })
})
