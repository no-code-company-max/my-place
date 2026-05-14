import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Tests de `updateLibraryCategoryAction`.
 *
 * Regresión 2026-05-14: el `kind` (GENERAL/COURSE) se validaba via Zod
 * pero NO se persistía en el UPDATE. Toda categoría editada quedaba con
 * el kind viejo, aun si el wizard mandaba `kind: 'COURSE'`.
 *
 * Comportamiento esperado:
 *  - Si el caller envía `kind`: sobreescribe.
 *  - Si el caller NO envía `kind`: el UPDATE no incluye el field
 *    (preserva el valor existente — útil para forms legacy que solo
 *    editan emoji+title).
 */

const libraryCategoryFindUnique = vi.fn()
const libraryCategoryUpdate = vi.fn()
const resolveActorForPlaceFn = vi.fn()
const hasPermissionFn = vi.fn()
const revalidatePathFn = vi.fn()

vi.mock('@/db/client', () => ({
  prisma: {
    libraryCategory: {
      findUnique: (...a: unknown[]) => libraryCategoryFindUnique(...a),
      update: (...a: unknown[]) => libraryCategoryUpdate(...a),
    },
  },
}))

vi.mock('@/features/discussions/public.server', () => ({
  resolveActorForPlace: (...a: unknown[]) => resolveActorForPlaceFn(...a),
}))

vi.mock('@/features/members/public.server', () => ({
  hasPermission: (...a: unknown[]) => hasPermissionFn(...a),
}))

vi.mock('next/cache', () => ({
  revalidatePath: (...a: unknown[]) => revalidatePathFn(...a),
  revalidateTag: vi.fn(),
  unstable_cache: <T extends (...args: unknown[]) => unknown>(fn: T): T => fn,
}))

vi.mock('server-only', () => ({}))

vi.mock('@/shared/config/env', () => ({
  serverEnv: { NODE_ENV: 'test' },
  clientEnv: {
    NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
    NEXT_PUBLIC_APP_URL: 'http://lvh.me:3000',
    NEXT_PUBLIC_APP_DOMAIN: 'lvh.me:3000',
  },
}))

import { updateLibraryCategoryAction } from '@/features/library/server/actions/update-category'
import { AuthorizationError, NotFoundError } from '@/shared/errors/domain-error'

const PLACE_ID = 'place-1'
const PLACE_SLUG = 'the-place'
const ACTOR_ID = 'user-1'
const CATEGORY_ID = 'cat-1'
const CATEGORY_SLUG = 'recetas'

function mockHappyDeps(opts: { allowed?: boolean } = {}): void {
  libraryCategoryFindUnique.mockResolvedValue({
    id: CATEGORY_ID,
    placeId: PLACE_ID,
    slug: CATEGORY_SLUG,
  })
  resolveActorForPlaceFn.mockResolvedValue({
    actorId: ACTOR_ID,
    placeId: PLACE_ID,
    placeSlug: PLACE_SLUG,
  })
  hasPermissionFn.mockResolvedValue(opts.allowed ?? true)
  libraryCategoryUpdate.mockResolvedValue(undefined)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('updateLibraryCategoryAction — kind persistence (regresión 2026-05-14)', () => {
  it('persiste kind=COURSE en el UPDATE cuando el caller lo envía', async () => {
    mockHappyDeps()

    await updateLibraryCategoryAction({
      categoryId: CATEGORY_ID,
      emoji: '📚',
      title: 'Recetas',
      kind: 'COURSE',
    })

    expect(libraryCategoryUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: CATEGORY_ID },
        data: expect.objectContaining({
          title: 'Recetas',
          emoji: '📚',
          kind: 'COURSE',
        }),
      }),
    )
  })

  it('NO incluye kind en el UPDATE cuando el caller lo omite (preserva existente)', async () => {
    mockHappyDeps()

    await updateLibraryCategoryAction({
      categoryId: CATEGORY_ID,
      emoji: '📚',
      title: 'Recetas',
      // kind omitido
    })

    const callArgs = libraryCategoryUpdate.mock.calls[0]?.[0] as { data: Record<string, unknown> }
    expect(callArgs.data).toEqual({ title: 'Recetas', emoji: '📚' })
    expect('kind' in callArgs.data).toBe(false)
  })

  it('persiste kind=GENERAL cuando el caller lo envía explícitamente (downgrade COURSE→GENERAL)', async () => {
    mockHappyDeps()

    await updateLibraryCategoryAction({
      categoryId: CATEGORY_ID,
      emoji: '📚',
      title: 'Recetas',
      kind: 'GENERAL',
    })

    expect(libraryCategoryUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          kind: 'GENERAL',
        }),
      }),
    )
  })
})

describe('updateLibraryCategoryAction — errores estructurales', () => {
  it('categoryId inexistente: NotFoundError sin tocar update', async () => {
    libraryCategoryFindUnique.mockResolvedValue(null)

    await expect(
      updateLibraryCategoryAction({
        categoryId: 'cat-OTHER',
        emoji: '📚',
        title: 'X',
      }),
    ).rejects.toBeInstanceOf(NotFoundError)

    expect(libraryCategoryUpdate).not.toHaveBeenCalled()
  })

  it('actor sin permiso: AuthorizationError', async () => {
    mockHappyDeps({ allowed: false })

    await expect(
      updateLibraryCategoryAction({
        categoryId: CATEGORY_ID,
        emoji: '📚',
        title: 'X',
      }),
    ).rejects.toBeInstanceOf(AuthorizationError)

    expect(libraryCategoryUpdate).not.toHaveBeenCalled()
  })
})
