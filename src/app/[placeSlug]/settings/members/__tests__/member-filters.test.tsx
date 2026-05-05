import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

const usePathnameMock = vi.fn()
const useSearchParamsMock = vi.fn()
const replaceMock = vi.fn()

vi.mock('next/navigation', () => ({
  usePathname: () => usePathnameMock(),
  useSearchParams: () => useSearchParamsMock(),
  useRouter: () => ({ replace: replaceMock }),
}))

import { MemberFilters } from '../components/member-filters'

const TIERS = [
  { id: 'tier_basic', name: 'Basic' },
  { id: 'tier_premium', name: 'Premium' },
]

const GROUPS = [
  { id: 'grp_admins', name: 'Administradores' },
  { id: 'grp_mods', name: 'Moderadores' },
]

beforeEach(() => {
  usePathnameMock.mockReset()
  useSearchParamsMock.mockReset()
  replaceMock.mockReset()
  usePathnameMock.mockReturnValue('/settings/members')
})

afterEach(() => cleanup())

function mockSearchParams(query: string): void {
  useSearchParamsMock.mockReturnValue(new URLSearchParams(query))
}

describe('MemberFilters (URL state)', () => {
  it('renderiza los 3 selects con default vacío cuando no hay filtros', () => {
    mockSearchParams('')
    render(<MemberFilters tiers={TIERS} groups={GROUPS} />)
    const groupSelect = screen.getByLabelText('Filtrar por grupo') as HTMLSelectElement
    const tierSelect = screen.getByLabelText('Filtrar por tier') as HTMLSelectElement
    const dateSelect = screen.getByLabelText('Filtrar por antigüedad') as HTMLSelectElement
    expect(groupSelect.value).toBe('')
    expect(tierSelect.value).toBe('')
    expect(dateSelect.value).toBe('')
  })

  it('hidrata cada select desde la URL', () => {
    mockSearchParams('groupId=grp_mods&tierId=tier_premium&joinedSince=30d')
    render(<MemberFilters tiers={TIERS} groups={GROUPS} />)
    expect((screen.getByLabelText('Filtrar por grupo') as HTMLSelectElement).value).toBe('grp_mods')
    expect((screen.getByLabelText('Filtrar por tier') as HTMLSelectElement).value).toBe(
      'tier_premium',
    )
    expect((screen.getByLabelText('Filtrar por antigüedad') as HTMLSelectElement).value).toBe('30d')
  })

  it('cambiar groupId dispara replace con `?groupId=...`', () => {
    mockSearchParams('')
    render(<MemberFilters tiers={TIERS} groups={GROUPS} />)
    fireEvent.change(screen.getByLabelText('Filtrar por grupo'), {
      target: { value: 'grp_admins' },
    })
    expect(replaceMock).toHaveBeenCalledWith('/settings/members?groupId=grp_admins', {
      scroll: false,
    })
  })

  it('cambiar tierId dispara replace con `?tierId=...`', () => {
    mockSearchParams('')
    render(<MemberFilters tiers={TIERS} groups={GROUPS} />)
    fireEvent.change(screen.getByLabelText('Filtrar por tier'), {
      target: { value: 'tier_basic' },
    })
    expect(replaceMock).toHaveBeenCalledWith('/settings/members?tierId=tier_basic', {
      scroll: false,
    })
  })

  it('opción "Sin tiers asignados" usa sentinel `__none__`', () => {
    mockSearchParams('')
    render(<MemberFilters tiers={TIERS} groups={GROUPS} />)
    fireEvent.change(screen.getByLabelText('Filtrar por tier'), {
      target: { value: '__none__' },
    })
    expect(replaceMock).toHaveBeenCalledWith('/settings/members?tierId=__none__', {
      scroll: false,
    })
  })

  it('cambiar joinedSince dispara replace con `?joinedSince=7d`', () => {
    mockSearchParams('')
    render(<MemberFilters tiers={TIERS} groups={GROUPS} />)
    fireEvent.change(screen.getByLabelText('Filtrar por antigüedad'), {
      target: { value: '7d' },
    })
    expect(replaceMock).toHaveBeenCalledWith('/settings/members?joinedSince=7d', { scroll: false })
  })

  it('cambiar a opción vacía borra el param de la URL', () => {
    mockSearchParams('groupId=grp_admins')
    render(<MemberFilters tiers={TIERS} groups={GROUPS} />)
    fireEvent.change(screen.getByLabelText('Filtrar por grupo'), { target: { value: '' } })
    expect(replaceMock).toHaveBeenCalledWith('/settings/members', { scroll: false })
  })

  it('preserva otros params al actualizar uno solo', () => {
    mockSearchParams('q=ana&joinedSince=30d')
    render(<MemberFilters tiers={TIERS} groups={GROUPS} />)
    fireEvent.change(screen.getByLabelText('Filtrar por grupo'), {
      target: { value: 'grp_admins' },
    })
    const calledWith = replaceMock.mock.calls[0]?.[0] as string
    expect(calledWith).toMatch(/q=ana/)
    expect(calledWith).toMatch(/joinedSince=30d/)
    expect(calledWith).toMatch(/groupId=grp_admins/)
  })

  it('botón "Limpiar filtros" no aparece si no hay filtros activos', () => {
    mockSearchParams('')
    render(<MemberFilters tiers={TIERS} groups={GROUPS} />)
    expect(screen.queryByRole('button', { name: /limpiar/i })).toBeNull()
  })

  it('botón "Limpiar filtros" aparece si hay algún filtro activo', () => {
    mockSearchParams('groupId=grp_admins')
    render(<MemberFilters tiers={TIERS} groups={GROUPS} />)
    expect(screen.getByRole('button', { name: /limpiar/i })).toBeInTheDocument()
  })

  it('botón "Limpiar filtros" aparece si solo `q` está activo (search bar es filtro)', () => {
    mockSearchParams('q=ana')
    render(<MemberFilters tiers={TIERS} groups={GROUPS} />)
    expect(screen.getByRole('button', { name: /limpiar/i })).toBeInTheDocument()
  })

  it('clic en "Limpiar filtros" borra todos los params (incluido q)', () => {
    mockSearchParams('q=ana&groupId=grp_admins&tierId=tier_basic&joinedSince=30d')
    render(<MemberFilters tiers={TIERS} groups={GROUPS} />)
    fireEvent.click(screen.getByRole('button', { name: /limpiar/i }))
    expect(replaceMock).toHaveBeenCalledWith('/settings/members', { scroll: false })
  })

  it('lista los tiers recibidos por props como opciones del select', () => {
    mockSearchParams('')
    render(<MemberFilters tiers={TIERS} groups={GROUPS} />)
    expect(screen.getByRole('option', { name: 'Basic' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Premium' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Todos los tiers' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Sin tiers asignados' })).toBeInTheDocument()
  })

  it('lista los grupos recibidos por props como opciones del select', () => {
    mockSearchParams('')
    render(<MemberFilters tiers={TIERS} groups={GROUPS} />)
    expect(screen.getByRole('option', { name: 'Administradores' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Moderadores' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Todos los grupos' })).toBeInTheDocument()
  })
})
