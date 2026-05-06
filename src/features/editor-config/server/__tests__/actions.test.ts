import { describe, it, expect, vi, beforeEach } from 'vitest'

const placeFindUnique = vi.fn()
const placeUpdate = vi.fn()
const findPlaceOwnershipFn = vi.fn()
const getUserFn = vi.fn()
const revalidatePathFn = vi.fn()
const revalidateTagFn = vi.fn()

vi.mock('@/db/client', () => ({
  prisma: {
    place: {
      findUnique: (...a: unknown[]) => placeFindUnique(...a),
      update: (...a: unknown[]) => placeUpdate(...a),
    },
  },
}))

vi.mock('@/shared/lib/supabase/server', () => ({
  createSupabaseServer: async () => ({ auth: { getUser: getUserFn } }),
}))

vi.mock('@/shared/lib/identity-cache', () => ({
  findPlaceOwnership: (...a: unknown[]) => findPlaceOwnershipFn(...a),
}))

vi.mock('next/cache', () => ({
  revalidatePath: (...a: unknown[]) => revalidatePathFn(...a),
  revalidateTag: (...a: unknown[]) => revalidateTagFn(...a),
  unstable_cache: <T extends (...args: never[]) => Promise<unknown>>(fn: T): T => fn,
}))

vi.mock('server-only', () => ({}))

vi.mock('@/shared/config/env', () => ({
  clientEnv: {
    NEXT_PUBLIC_APP_URL: 'http://lvh.me:3000',
    NEXT_PUBLIC_APP_DOMAIN: 'lvh.me:3000',
    NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
  },
  serverEnv: { SUPABASE_SERVICE_ROLE_KEY: 'service', NODE_ENV: 'test' },
}))

import { updateEditorConfigAction } from '../actions'

const AUTH_OK = { data: { user: { id: 'user-owner' } } }
const AUTH_NONE = { data: { user: null } }

const VALID_CONFIG = {
  youtube: true,
  spotify: false,
  applePodcasts: true,
  ivoox: false,
}

function makePlace(overrides: Record<string, unknown> = {}) {
  return {
    id: 'place-1',
    slug: 'the-company',
    archivedAt: null,
    ...overrides,
  }
}

beforeEach(() => {
  placeFindUnique.mockReset()
  placeUpdate.mockReset()
  findPlaceOwnershipFn.mockReset()
  getUserFn.mockReset()
  revalidatePathFn.mockReset()
  revalidateTagFn.mockReset()
})

describe('updateEditorConfigAction', () => {
  it('rechaza config inválida con error: "invalid"', async () => {
    getUserFn.mockResolvedValue(AUTH_OK)
    const res = await updateEditorConfigAction({
      placeId: 'place-1',
      // @ts-expect-error caso inválido a propósito
      config: { youtube: true },
    })
    expect(res).toEqual({ ok: false, error: 'invalid' })
    expect(placeUpdate).not.toHaveBeenCalled()
  })

  it('rechaza placeId vacío con error: "invalid"', async () => {
    getUserFn.mockResolvedValue(AUTH_OK)
    const res = await updateEditorConfigAction({ placeId: '', config: VALID_CONFIG })
    expect(res).toEqual({ ok: false, error: 'invalid' })
  })

  it('retorna error: "not_found" si el place no existe', async () => {
    getUserFn.mockResolvedValue(AUTH_OK)
    placeFindUnique.mockResolvedValue(null)
    const res = await updateEditorConfigAction({ placeId: 'place-1', config: VALID_CONFIG })
    expect(res).toEqual({ ok: false, error: 'not_found' })
  })

  it('retorna error: "not_found" si el place está archivado', async () => {
    getUserFn.mockResolvedValue(AUTH_OK)
    placeFindUnique.mockResolvedValue(makePlace({ archivedAt: new Date() }))
    const res = await updateEditorConfigAction({ placeId: 'place-1', config: VALID_CONFIG })
    expect(res).toEqual({ ok: false, error: 'not_found' })
  })

  it('retorna error: "forbidden" si el viewer no es owner', async () => {
    getUserFn.mockResolvedValue(AUTH_OK)
    placeFindUnique.mockResolvedValue(makePlace())
    findPlaceOwnershipFn.mockResolvedValue(false)
    const res = await updateEditorConfigAction({ placeId: 'place-1', config: VALID_CONFIG })
    expect(res).toEqual({ ok: false, error: 'forbidden' })
    expect(placeUpdate).not.toHaveBeenCalled()
  })

  it('persiste y revalida cuando el viewer es owner', async () => {
    getUserFn.mockResolvedValue(AUTH_OK)
    placeFindUnique.mockResolvedValue(makePlace())
    findPlaceOwnershipFn.mockResolvedValue(true)
    placeUpdate.mockResolvedValue({})

    const res = await updateEditorConfigAction({ placeId: 'place-1', config: VALID_CONFIG })

    expect(res).toEqual({ ok: true })
    expect(placeUpdate).toHaveBeenCalledWith({
      where: { id: 'place-1' },
      data: { editorPluginsConfig: VALID_CONFIG },
    })
    expect(revalidateTagFn).toHaveBeenCalledWith('editor-config:place-1')
    expect(revalidatePathFn).toHaveBeenCalledWith('/the-company/settings/editor')
  })

  it('rechaza session ausente vía requireAuthUserId (AuthorizationError)', async () => {
    getUserFn.mockResolvedValue(AUTH_NONE)
    await expect(
      updateEditorConfigAction({ placeId: 'place-1', config: VALID_CONFIG }),
    ).rejects.toBeDefined()
  })
})
