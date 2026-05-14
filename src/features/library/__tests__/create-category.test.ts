import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Tests de `createLibraryCategoryAction`.
 *
 * **Origen (2026-05-14):** regresión del bug histórico donde el `kind`
 * (GENERAL/COURSE) se validaba via Zod pero NO se persistía en el INSERT
 * de Prisma. Resultado: toda categoría quedaba como `GENERAL` aun si el
 * wizard mandaba `kind: 'COURSE'`. El bug bloqueaba toda la feature de
 * courses (PrereqToggleSelector nunca aparecía porque
 * `category.kind === 'COURSE'` era siempre false).
 *
 * Estos tests cubren el shape del INSERT (foco en regresión) +
 * autorización + capacity + slug resolution. NO cubren el ramp completo
 * del scope kinds (read/write) — esos viven en sub-slices con sus actions.
 */

const libraryCategoryCount = vi.fn()
const libraryCategoryFindMany = vi.fn()
const libraryCategoryCreate = vi.fn()
const resolveActorForPlaceFn = vi.fn()
const hasPermissionFn = vi.fn()
const revalidatePathFn = vi.fn()

vi.mock('@/db/client', () => ({
  prisma: {
    libraryCategory: {
      count: (...a: unknown[]) => libraryCategoryCount(...a),
      findMany: (...a: unknown[]) => libraryCategoryFindMany(...a),
      create: (...a: unknown[]) => libraryCategoryCreate(...a),
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

import { createLibraryCategoryAction } from '@/features/library/server/actions/create-category'
import { AuthorizationError, ValidationError } from '@/shared/errors/domain-error'

const PLACE_ID = 'place-1'
const PLACE_SLUG = 'the-place'
const ACTOR_ID = 'user-1'
const NEW_CATEGORY_ID = 'cat-new'

function mockHappyDeps(opts: { allowed?: boolean } = {}): void {
  resolveActorForPlaceFn.mockResolvedValue({
    actorId: ACTOR_ID,
    placeId: PLACE_ID,
    placeSlug: PLACE_SLUG,
  })
  hasPermissionFn.mockResolvedValue(opts.allowed ?? true)
  libraryCategoryCount.mockResolvedValue(0)
  libraryCategoryFindMany.mockResolvedValue([])
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createLibraryCategoryAction — kind persistence (regresión 2026-05-14)', () => {
  it('persiste kind=COURSE en el INSERT cuando el wizard lo envía', async () => {
    mockHappyDeps()
    libraryCategoryCreate.mockResolvedValue({
      id: NEW_CATEGORY_ID,
      slug: 'recetas',
      kind: 'COURSE',
    })

    await createLibraryCategoryAction({
      placeId: PLACE_ID,
      emoji: '📚',
      title: 'Recetas',
      kind: 'COURSE',
    })

    expect(libraryCategoryCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          placeId: PLACE_ID,
          emoji: '📚',
          title: 'Recetas',
          kind: 'COURSE',
        }),
      }),
    )
  })

  it('default a kind=GENERAL en el INSERT cuando el caller NO envía kind', async () => {
    mockHappyDeps()
    libraryCategoryCreate.mockResolvedValue({
      id: NEW_CATEGORY_ID,
      slug: 'general',
      kind: 'GENERAL',
    })

    await createLibraryCategoryAction({
      placeId: PLACE_ID,
      emoji: '📚',
      title: 'General',
      // kind omitido → schema rellena con 'GENERAL'
    })

    expect(libraryCategoryCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          kind: 'GENERAL',
        }),
      }),
    )
  })
})

describe('createLibraryCategoryAction — validación', () => {
  it('input sin placeId: ValidationError sin tocar Prisma', async () => {
    await expect(
      createLibraryCategoryAction({ emoji: '📚', title: 'X', kind: 'GENERAL' }),
    ).rejects.toBeInstanceOf(ValidationError)
    expect(libraryCategoryCreate).not.toHaveBeenCalled()
  })

  it('kind inválido (no enum): ValidationError', async () => {
    await expect(
      createLibraryCategoryAction({
        placeId: PLACE_ID,
        emoji: '📚',
        title: 'X',
        kind: 'BOGUS',
      }),
    ).rejects.toBeInstanceOf(ValidationError)
    expect(libraryCategoryCreate).not.toHaveBeenCalled()
  })
})

describe('createLibraryCategoryAction — autorización', () => {
  it('actor sin permiso library:moderate-categories: AuthorizationError', async () => {
    mockHappyDeps({ allowed: false })

    await expect(
      createLibraryCategoryAction({
        placeId: PLACE_ID,
        emoji: '📚',
        title: 'X',
        kind: 'GENERAL',
      }),
    ).rejects.toBeInstanceOf(AuthorizationError)
    expect(libraryCategoryCreate).not.toHaveBeenCalled()
  })
})
