import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

// Mocks de los colaboradores del layout. Definidos antes del import del SUT
// para que vitest los aplique en orden (los `vi.mock` son hoisted, pero las
// referencias con `vi.fn()` se resuelven a través del import dinámico).
const redirectMock = vi.fn((_path: string): never => {
  // El layout llama `redirect(...)` y NO retorna después; en runtime real
  // Next levanta una excepción especial para abortar el render. Replicamos
  // ese contrato acá: el await sobre el layout debe rechazar, así el test
  // distingue "se redirigió" de "renderizó algo igual".
  throw new Error('NEXT_REDIRECT')
})
const notFoundMock = vi.fn((): never => {
  throw new Error('NEXT_NOT_FOUND')
})

vi.mock('next/navigation', () => ({
  redirect: (path: string) => redirectMock(path),
  notFound: () => notFoundMock(),
}))

const getCurrentAuthUserMock = vi.fn()
vi.mock('@/shared/lib/auth-user', () => ({
  getCurrentAuthUser: () => getCurrentAuthUserMock(),
}))

const loadPlaceBySlugMock = vi.fn()
vi.mock('@/shared/lib/place-loader', () => ({
  loadPlaceBySlug: (slug: string) => loadPlaceBySlugMock(slug),
}))

const findMemberPermissionsMock = vi.fn()
vi.mock('@/features/members/public.server', () => ({
  findMemberPermissions: (userId: string, placeId: string) =>
    findMemberPermissionsMock(userId, placeId),
}))

// Stub del FAB con `data-testid` predecible: así verificamos que el layout lo
// MONTA (regresión del bug original donde el return era `<>{children}</>` sin
// el FAB) y que le pasa `isOwner` correctamente.
vi.mock('@/features/shell/public', () => ({
  SettingsNavFab: ({ isOwner }: { isOwner?: boolean }) => (
    <div data-testid="settings-nav-fab" data-is-owner={String(!!isOwner)} />
  ),
}))

import SettingsLayout from '../layout'

const PLACE_SLUG = 'p'

function makeParams() {
  return Promise.resolve({ placeSlug: PLACE_SLUG })
}

function makeChildren() {
  return <div data-testid="kids" />
}

beforeEach(() => {
  redirectMock.mockClear()
  notFoundMock.mockClear()
  getCurrentAuthUserMock.mockReset()
  loadPlaceBySlugMock.mockReset()
  findMemberPermissionsMock.mockReset()
})

afterEach(() => cleanup())

describe('SettingsLayout (gate admin/owner + montaje del FAB)', () => {
  it('redirect a /login?next=/settings cuando no hay sesión', async () => {
    getCurrentAuthUserMock.mockResolvedValue(null)

    await expect(
      SettingsLayout({ children: makeChildren(), params: makeParams() }),
    ).rejects.toThrow('NEXT_REDIRECT')

    expect(redirectMock).toHaveBeenCalledWith('/login?next=/settings')
    // Si redirige, no debió tocar place-loader ni permisos.
    expect(loadPlaceBySlugMock).not.toHaveBeenCalled()
    expect(findMemberPermissionsMock).not.toHaveBeenCalled()
  })

  it('notFound() cuando el place no existe', async () => {
    getCurrentAuthUserMock.mockResolvedValue({ id: 'usr_1', email: 'a@b.c' })
    loadPlaceBySlugMock.mockResolvedValue(null)

    await expect(
      SettingsLayout({ children: makeChildren(), params: makeParams() }),
    ).rejects.toThrow('NEXT_NOT_FOUND')

    expect(notFoundMock).toHaveBeenCalledTimes(1)
    expect(findMemberPermissionsMock).not.toHaveBeenCalled()
  })

  it('notFound() cuando el place está archivado', async () => {
    getCurrentAuthUserMock.mockResolvedValue({ id: 'usr_1', email: 'a@b.c' })
    loadPlaceBySlugMock.mockResolvedValue({
      id: 'place_1',
      slug: PLACE_SLUG,
      archivedAt: new Date('2026-01-01T00:00:00Z'),
    })

    await expect(
      SettingsLayout({ children: makeChildren(), params: makeParams() }),
    ).rejects.toThrow('NEXT_NOT_FOUND')

    expect(notFoundMock).toHaveBeenCalledTimes(1)
    expect(findMemberPermissionsMock).not.toHaveBeenCalled()
  })

  it('notFound() cuando el usuario no es admin (ni owner)', async () => {
    getCurrentAuthUserMock.mockResolvedValue({ id: 'usr_1', email: 'a@b.c' })
    loadPlaceBySlugMock.mockResolvedValue({
      id: 'place_1',
      slug: PLACE_SLUG,
      archivedAt: null,
    })
    findMemberPermissionsMock.mockResolvedValue({
      isMember: true,
      isOwner: false,
      isAdmin: false,
    })

    await expect(
      SettingsLayout({ children: makeChildren(), params: makeParams() }),
    ).rejects.toThrow('NEXT_NOT_FOUND')

    expect(notFoundMock).toHaveBeenCalledTimes(1)
    expect(findMemberPermissionsMock).toHaveBeenCalledWith('usr_1', 'place_1')
  })

  // Asserts clave que protegen el bug original: el layout DEBE retornar el FAB
  // como sibling de `{children}`. Si alguien borra `<SettingsNavFab>` del
  // return, estos tests rompen.
  it('admin/owner: monta {children} Y SettingsNavFab con isOwner=true', async () => {
    getCurrentAuthUserMock.mockResolvedValue({ id: 'usr_1', email: 'a@b.c' })
    loadPlaceBySlugMock.mockResolvedValue({
      id: 'place_1',
      slug: PLACE_SLUG,
      archivedAt: null,
    })
    findMemberPermissionsMock.mockResolvedValue({
      isMember: true,
      isOwner: true,
      isAdmin: true,
    })

    const ui = await SettingsLayout({
      children: makeChildren(),
      params: makeParams(),
    })
    render(ui)

    expect(screen.getByTestId('kids')).toBeInTheDocument()
    expect(screen.getByTestId('settings-nav-fab')).toBeInTheDocument()
    expect(screen.getByTestId('settings-nav-fab')).toHaveAttribute('data-is-owner', 'true')
    // Sanity: ningún redirect/notFound se llamó en el happy path.
    expect(redirectMock).not.toHaveBeenCalled()
    expect(notFoundMock).not.toHaveBeenCalled()
  })

  it('admin no-owner: monta SettingsNavFab con isOwner=false (prop wiring)', async () => {
    getCurrentAuthUserMock.mockResolvedValue({ id: 'usr_1', email: 'a@b.c' })
    loadPlaceBySlugMock.mockResolvedValue({
      id: 'place_1',
      slug: PLACE_SLUG,
      archivedAt: null,
    })
    findMemberPermissionsMock.mockResolvedValue({
      isMember: true,
      isOwner: false,
      isAdmin: true,
    })

    const ui = await SettingsLayout({
      children: makeChildren(),
      params: makeParams(),
    })
    render(ui)

    expect(screen.getByTestId('settings-nav-fab')).toHaveAttribute('data-is-owner', 'false')
  })
})
