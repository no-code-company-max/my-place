import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma } from '@prisma/client'
import {
  AuthorizationError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '@/shared/errors/domain-error'

/**
 * Test para `createLibraryItemAction`.
 *
 * **S4 (2026-05-13) — Rewrite contra modelo de permisos v2:** el gate
 * legacy `canCreateInCategory(contributionPolicy + designatedUserIds)`
 * fue reemplazado por `findWriteScope` + `canWriteCategory` del sub-slice
 * `library/contribution/`. Este archivo testea el nuevo flow.
 *
 * Mocks principales:
 *  - `prisma.libraryCategory.findUnique` con shape mínimo
 *    `{ id, slug, placeId, archivedAt }` (sin contributionPolicy ni
 *    groupScopes).
 *  - `findWriteScope` desde `@/features/library/contribution/public.server`
 *    — retorna el discriminated `{ kind, groupIds, tierIds, userIds }`.
 *  - `prisma.$transaction` con tx que expone `libraryItem.create`.
 *  - `createPostFromSystemHelper` mockeado para no reimplementar slug
 *    resolution bajo tx.
 *  - Auth chain (`getUser` + place + membership + ownership + user)
 *    real-ish para ejercer `resolveActorForPlace`.
 *
 * Cobertura:
 *  - Happy paths: owner bypassa OWNER_ONLY; member en USERS scope crea;
 *    member en GROUPS scope crea; coverUrl persistence.
 *  - Autorización: member sin owner bypass + sin write scope → 401.
 *  - Validación Zod (title, coverUrl, categoryId).
 *  - Errores estructurales: category not found, cross-place, archived.
 *  - Atomicidad: P2003 (FK violation) → ConflictError tipado;
 *    P2002 slug collision propaga.
 *
 * El RLS replica el gate a nivel SQL (defense in depth) — no testeado
 * acá; lo cubren los tests de RLS específicos.
 */

// ---------------------------------------------------------------
// Prisma + auxiliares mockeados
// ---------------------------------------------------------------

const libraryCategoryFindUnique = vi.fn()
const placeFindUnique = vi.fn()
const membershipFindFirst = vi.fn()
const ownershipFindUnique = vi.fn()
const userFindUnique = vi.fn()
const transactionFn = vi.fn()
const txLibraryItemCreate = vi.fn()
const getUserFn = vi.fn()
const revalidatePathFn = vi.fn()
const assertPlaceOpenFn = vi.fn()
const findWriteScopeFn = vi.fn()
const createPostFromSystemHelperFn = vi.fn()
const groupMembershipFindMany = vi.fn(async (..._a: unknown[]) => [] as unknown[])
const groupMembershipFindFirst = vi.fn(async (..._a: unknown[]) => null as unknown)
const tierMembershipFindMany = vi.fn(async (..._a: unknown[]) => [] as unknown[])

vi.mock('@/db/client', () => ({
  prisma: {
    libraryCategory: {
      findUnique: (...a: unknown[]) => libraryCategoryFindUnique(...a),
    },
    place: { findUnique: (...a: unknown[]) => placeFindUnique(...a) },
    membership: { findFirst: (...a: unknown[]) => membershipFindFirst(...a) },
    placeOwnership: { findUnique: (...a: unknown[]) => ownershipFindUnique(...a) },
    user: { findUnique: (...a: unknown[]) => userFindUnique(...a) },
    groupMembership: {
      findMany: (...a: unknown[]) => groupMembershipFindMany(...a),
      findFirst: (...a: unknown[]) => groupMembershipFindFirst(...a),
    },
    tierMembership: {
      findMany: (...a: unknown[]) => tierMembershipFindMany(...a),
    },
    $transaction: (fn: (tx: unknown) => unknown) => transactionFn(fn),
  },
}))

vi.mock('@/shared/lib/supabase/server', () => ({
  createSupabaseServer: async () => ({ auth: { getUser: getUserFn } }),
}))

vi.mock('next/cache', () => ({
  unstable_cache: <T extends (...args: unknown[]) => unknown>(fn: T): T => fn,
  revalidatePath: (...a: unknown[]) => revalidatePathFn(...a),
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

vi.mock('@/features/hours/public.server', () => ({
  assertPlaceOpenOrThrow: (...a: unknown[]) => assertPlaceOpenFn(...a),
  findPlaceHours: vi.fn(async () => ({ kind: 'always_open' })),
}))

vi.mock('@/features/discussions/public.server', async () => {
  const real = await vi.importActual<typeof import('@/features/discussions/public.server')>(
    '@/features/discussions/public.server',
  )
  return {
    ...real,
    createPostFromSystemHelper: (...a: unknown[]) => createPostFromSystemHelperFn(...a),
  }
})

vi.mock('@/features/library/contribution/public.server', () => ({
  findWriteScope: (...a: unknown[]) => findWriteScopeFn(...a),
}))

// ---------------------------------------------------------------
// Imports después del setup (hoisting de vi.mock)
// ---------------------------------------------------------------

import { createLibraryItemAction } from '@/features/library/server/actions/create-item'
import { PERMISSIONS_ALL } from '@/features/groups/public'

// ---------------------------------------------------------------
// Fixtures + helper
// ---------------------------------------------------------------

const PLACE_ID = 'place-1'
const PLACE_SLUG = 'the-place'
const USER_ID = 'user-1'
const OTHER_USER_ID = 'user-2'
const CATEGORY_ID = 'cat-1'
const CATEGORY_SLUG = 'recetas'
const POST_ID = 'post-1'
const POST_SLUG = 'pan-de-campo'
const ITEM_ID = 'item-1'

const validBody = {
  root: {
    type: 'root' as const,
    version: 1 as const,
    format: '' as const,
    indent: 0,
    direction: 'ltr' as const,
    children: [
      {
        type: 'paragraph' as const,
        version: 1 as const,
        format: '' as const,
        indent: 0,
        direction: 'ltr' as const,
        textFormat: 0,
        textStyle: '',
        children: [
          {
            type: 'text' as const,
            version: 1 as const,
            text: 'receta',
            format: 0,
            detail: 0,
            mode: 'normal' as const,
            style: '',
          },
        ],
      },
    ],
  },
}

type ActorOpts = {
  asAdmin?: boolean
  isOwner?: boolean
  /** Grupos del viewer (popula `viewer.groupIds`). */
  groupIds?: ReadonlyArray<string>
  /** Tiers activos del viewer (popula `viewer.tierIds`). */
  tierIds?: ReadonlyArray<string>
}

function mockActiveMember(opts: ActorOpts = {}): void {
  getUserFn.mockResolvedValue({ data: { user: { id: USER_ID } } })
  placeFindUnique.mockResolvedValue({
    id: PLACE_ID,
    slug: PLACE_SLUG,
    name: 'The Place',
    archivedAt: null,
    themeConfig: null,
    openingHours: null,
  })
  membershipFindFirst.mockResolvedValue({ id: 'm-1' })
  ownershipFindUnique.mockResolvedValue(opts.isOwner ? { userId: USER_ID } : null)
  userFindUnique.mockResolvedValue({ displayName: 'Max', avatarUrl: null })
  assertPlaceOpenFn.mockResolvedValue(undefined)
  // `groupMembership.findMany` lo llama `resolveLibraryViewer` con
  // `select: { groupId: true }` para popular `viewer.groupIds`.
  // Si opts.asAdmin, sumamos el preset group para que `findIsPlaceAdmin`
  // (vía `groupMembershipFindFirst`) retorne true.
  const groupRows: Array<{ groupId: string }> = (opts.groupIds ?? []).map((id) => ({
    groupId: id,
  }))
  if (opts.asAdmin) {
    groupRows.push({ groupId: 'grp-mock-admin' })
    groupMembershipFindFirst.mockResolvedValue({ id: 'gm-mock-admin' })
  } else {
    groupMembershipFindFirst.mockResolvedValue(null)
  }
  groupMembershipFindMany.mockResolvedValue(groupRows)
  // Suprime warning de variable no usada — PERMISSIONS_ALL queda en el
  // import por compatibilidad histórica si volvemos a testear hasPermission.
  void PERMISSIONS_ALL
  tierMembershipFindMany.mockResolvedValue(
    (opts.tierIds ?? []).map((id) => ({ tierId: id, expiresAt: null })),
  )
  transactionFn.mockImplementation((fn: (tx: unknown) => unknown) =>
    fn({
      libraryItem: { create: txLibraryItemCreate },
    }),
  )
}

function mockCategoryHappy(overrides: Partial<{ archivedAt: Date | null; placeId: string }> = {}) {
  libraryCategoryFindUnique.mockResolvedValue({
    id: CATEGORY_ID,
    slug: CATEGORY_SLUG,
    placeId: overrides.placeId ?? PLACE_ID,
    archivedAt: overrides.archivedAt ?? null,
  })
}

function mockWriteScope(
  kind: 'OWNER_ONLY' | 'GROUPS' | 'TIERS' | 'USERS',
  opts: {
    groupIds?: ReadonlyArray<string>
    tierIds?: ReadonlyArray<string>
    userIds?: ReadonlyArray<string>
  } = {},
): void {
  findWriteScopeFn.mockResolvedValue({
    kind,
    groupIds: opts.groupIds ?? [],
    tierIds: opts.tierIds ?? [],
    userIds: opts.userIds ?? [],
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

function validInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    placeId: PLACE_ID,
    categoryId: CATEGORY_ID,
    title: 'Pan de campo',
    body: validBody,
    coverUrl: null,
    ...overrides,
  }
}

// ---------------------------------------------------------------
// Tests
// ---------------------------------------------------------------

describe('createLibraryItemAction — happy paths', () => {
  it('owner: OWNER_ONLY pasa via owner bypass; crea Post + LibraryItem y revalida los 4 paths', async () => {
    mockActiveMember({ isOwner: true })
    mockCategoryHappy()
    mockWriteScope('OWNER_ONLY')
    createPostFromSystemHelperFn.mockResolvedValue({ id: POST_ID, slug: POST_SLUG })
    txLibraryItemCreate.mockResolvedValue({ id: ITEM_ID })

    const result = await createLibraryItemAction(validInput())

    expect(result).toEqual({
      ok: true,
      itemId: ITEM_ID,
      postSlug: POST_SLUG,
      categorySlug: CATEGORY_SLUG,
    })
    expect(findWriteScopeFn).toHaveBeenCalledWith(CATEGORY_ID)
    expect(createPostFromSystemHelperFn).toHaveBeenCalledTimes(1)
    expect(txLibraryItemCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          placeId: PLACE_ID,
          categoryId: CATEGORY_ID,
          postId: POST_ID,
          authorUserId: USER_ID,
          authorSnapshot: { displayName: 'Max', avatarUrl: null },
          coverUrl: null,
        }),
      }),
    )
    expect(revalidatePathFn).toHaveBeenCalledWith(`/${PLACE_SLUG}/library`)
    expect(revalidatePathFn).toHaveBeenCalledWith(`/${PLACE_SLUG}/library/${CATEGORY_SLUG}`)
    expect(revalidatePathFn).toHaveBeenCalledWith(
      `/${PLACE_SLUG}/library/${CATEGORY_SLUG}/${POST_SLUG}`,
    )
    expect(revalidatePathFn).toHaveBeenCalledWith(`/${PLACE_SLUG}/conversations`)
  })

  it('member en USERS scope: crea sin necesidad de owner bypass', async () => {
    mockActiveMember()
    mockCategoryHappy()
    mockWriteScope('USERS', { userIds: [USER_ID, OTHER_USER_ID] })
    createPostFromSystemHelperFn.mockResolvedValue({ id: POST_ID, slug: POST_SLUG })
    txLibraryItemCreate.mockResolvedValue({ id: ITEM_ID })

    const result = await createLibraryItemAction(validInput())

    expect(result.ok).toBe(true)
    expect(txLibraryItemCreate).toHaveBeenCalledTimes(1)
  })

  it('member en GROUPS scope (matchea uno de sus groupIds): crea ok', async () => {
    mockActiveMember({ groupIds: ['grp-mods'] })
    mockCategoryHappy()
    mockWriteScope('GROUPS', { groupIds: ['grp-mods', 'grp-otro'] })
    createPostFromSystemHelperFn.mockResolvedValue({ id: POST_ID, slug: POST_SLUG })
    txLibraryItemCreate.mockResolvedValue({ id: ITEM_ID })

    const result = await createLibraryItemAction(validInput())

    expect(result.ok).toBe(true)
  })

  it('member en TIERS scope (con tier activo): crea ok', async () => {
    mockActiveMember({ tierIds: ['tier-pro'] })
    mockCategoryHappy()
    mockWriteScope('TIERS', { tierIds: ['tier-pro'] })
    createPostFromSystemHelperFn.mockResolvedValue({ id: POST_ID, slug: POST_SLUG })
    txLibraryItemCreate.mockResolvedValue({ id: ITEM_ID })

    const result = await createLibraryItemAction(validInput())

    expect(result.ok).toBe(true)
  })

  it('coverUrl válida (https): se persiste tal cual al LibraryItem', async () => {
    mockActiveMember({ isOwner: true })
    mockCategoryHappy()
    mockWriteScope('OWNER_ONLY')
    createPostFromSystemHelperFn.mockResolvedValue({ id: POST_ID, slug: POST_SLUG })
    txLibraryItemCreate.mockResolvedValue({ id: ITEM_ID })

    await createLibraryItemAction(validInput({ coverUrl: 'https://images.example.com/pan.jpg' }))

    expect(txLibraryItemCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          coverUrl: 'https://images.example.com/pan.jpg',
        }),
      }),
    )
  })
})

describe('createLibraryItemAction — autorización', () => {
  it('member sin owner bypass en OWNER_ONLY: AuthorizationError sin tocar la tx', async () => {
    mockActiveMember()
    mockCategoryHappy()
    mockWriteScope('OWNER_ONLY')

    await expect(createLibraryItemAction(validInput())).rejects.toBeInstanceOf(AuthorizationError)

    expect(transactionFn).not.toHaveBeenCalled()
    expect(createPostFromSystemHelperFn).not.toHaveBeenCalled()
    expect(txLibraryItemCreate).not.toHaveBeenCalled()
    expect(revalidatePathFn).not.toHaveBeenCalled()
  })

  it('member en USERS sin estar en el set: AuthorizationError', async () => {
    mockActiveMember()
    mockCategoryHappy()
    mockWriteScope('USERS', { userIds: [OTHER_USER_ID] })

    await expect(createLibraryItemAction(validInput())).rejects.toBeInstanceOf(AuthorizationError)

    expect(transactionFn).not.toHaveBeenCalled()
  })

  it('member en GROUPS sin matchear ningún grupo: AuthorizationError', async () => {
    mockActiveMember({ groupIds: ['grp-x'] })
    mockCategoryHappy()
    mockWriteScope('GROUPS', { groupIds: ['grp-mods'] })

    await expect(createLibraryItemAction(validInput())).rejects.toBeInstanceOf(AuthorizationError)

    expect(transactionFn).not.toHaveBeenCalled()
  })

  it('member en TIERS sin tier activo en el set: AuthorizationError', async () => {
    mockActiveMember({ tierIds: ['tier-basic'] })
    mockCategoryHappy()
    mockWriteScope('TIERS', { tierIds: ['tier-pro'] })

    await expect(createLibraryItemAction(validInput())).rejects.toBeInstanceOf(AuthorizationError)

    expect(transactionFn).not.toHaveBeenCalled()
  })
})

describe('createLibraryItemAction — validación', () => {
  it('title vacío (solo whitespace): ValidationError sin tocar Prisma de dominio', async () => {
    await expect(createLibraryItemAction(validInput({ title: '   ' }))).rejects.toBeInstanceOf(
      ValidationError,
    )

    expect(libraryCategoryFindUnique).not.toHaveBeenCalled()
    expect(transactionFn).not.toHaveBeenCalled()
  })

  it('title que supera POST_TITLE_MAX_LENGTH: ValidationError', async () => {
    const tooLong = 'x'.repeat(500)
    await expect(createLibraryItemAction(validInput({ title: tooLong }))).rejects.toBeInstanceOf(
      ValidationError,
    )
    expect(libraryCategoryFindUnique).not.toHaveBeenCalled()
  })

  it('coverUrl no http(s): ValidationError después del actor pero antes de la tx', async () => {
    mockActiveMember({ isOwner: true })
    mockCategoryHappy()
    mockWriteScope('OWNER_ONLY')

    await expect(
      createLibraryItemAction(validInput({ coverUrl: 'javascript:alert(1)' })),
    ).rejects.toBeInstanceOf(ValidationError)

    expect(transactionFn).not.toHaveBeenCalled()
    expect(createPostFromSystemHelperFn).not.toHaveBeenCalled()
    expect(txLibraryItemCreate).not.toHaveBeenCalled()
  })

  it('input sin categoryId: ValidationError sin tocar Prisma', async () => {
    await expect(createLibraryItemAction(validInput({ categoryId: '' }))).rejects.toBeInstanceOf(
      ValidationError,
    )
    expect(libraryCategoryFindUnique).not.toHaveBeenCalled()
  })
})

describe('createLibraryItemAction — errores estructurales', () => {
  it('categoryId inexistente: NotFoundError sin entrar a la tx', async () => {
    mockActiveMember({ isOwner: true })
    libraryCategoryFindUnique.mockResolvedValue(null)

    await expect(createLibraryItemAction(validInput())).rejects.toBeInstanceOf(NotFoundError)

    expect(transactionFn).not.toHaveBeenCalled()
    expect(createPostFromSystemHelperFn).not.toHaveBeenCalled()
    expect(txLibraryItemCreate).not.toHaveBeenCalled()
  })

  it('categoría de otro place: NotFoundError (anti cross-place)', async () => {
    mockActiveMember({ isOwner: true })
    mockCategoryHappy({ placeId: 'place-OTHER' })

    await expect(createLibraryItemAction(validInput())).rejects.toBeInstanceOf(NotFoundError)

    expect(transactionFn).not.toHaveBeenCalled()
  })

  it('categoría archivada al momento del check: NotFoundError sin entrar a la tx', async () => {
    mockActiveMember({ isOwner: true })
    mockCategoryHappy({ archivedAt: new Date('2026-04-01T12:00:00Z') })

    await expect(createLibraryItemAction(validInput())).rejects.toBeInstanceOf(NotFoundError)

    expect(transactionFn).not.toHaveBeenCalled()
    expect(createPostFromSystemHelperFn).not.toHaveBeenCalled()
  })

  it('findWriteScope retorna null (category race): NotFoundError defensivo', async () => {
    mockActiveMember({ isOwner: true })
    mockCategoryHappy()
    findWriteScopeFn.mockResolvedValue(null)

    await expect(createLibraryItemAction(validInput())).rejects.toBeInstanceOf(NotFoundError)

    expect(transactionFn).not.toHaveBeenCalled()
  })
})

describe('createLibraryItemAction — atomicidad y errores en tx', () => {
  /**
   * Bug histórico (cerrado): si la categoría se archiva/borra **entre** el
   * `findUnique` y el `tx.libraryItem.create`, el Post se intentaría crear
   * con un categoryId obsoleto. La tx envuelve ambos INSERTs, así que un
   * fallo del segundo rollbackea el primero (no hay Post huérfano). La
   * action convierte `Prisma.PrismaClientKnownRequestError` con código
   * `P2003` (FK violation) en `ConflictError` tipado para que la UI pueda
   * pedir reload + reintento.
   */
  it('race condition: P2003 al insertar item → ConflictError tipado, sin revalidate', async () => {
    mockActiveMember({ isOwner: true })
    mockCategoryHappy()
    mockWriteScope('OWNER_ONLY')
    createPostFromSystemHelperFn.mockResolvedValue({ id: POST_ID, slug: POST_SLUG })
    txLibraryItemCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('FK constraint failed', {
        code: 'P2003',
        clientVersion: 'test',
      }),
    )

    await expect(createLibraryItemAction(validInput())).rejects.toBeInstanceOf(ConflictError)
    expect(revalidatePathFn).not.toHaveBeenCalled()
  })

  it('P2002 colisión de slug en post: createPostFromSystemHelper lanza ConflictError y la action lo propaga', async () => {
    mockActiveMember({ isOwner: true })
    mockCategoryHappy()
    mockWriteScope('OWNER_ONLY')
    createPostFromSystemHelperFn.mockRejectedValue(
      new ConflictError('No pudimos asignar una URL única para el thread del evento.', {
        placeId: PLACE_ID,
        title: 'Pan de campo',
        originSystem: 'library_item',
        originId: 'pending',
      }),
    )

    await expect(createLibraryItemAction(validInput())).rejects.toBeInstanceOf(ConflictError)

    expect(txLibraryItemCreate).not.toHaveBeenCalled()
    expect(revalidatePathFn).not.toHaveBeenCalled()
  })
})
