import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma } from '@prisma/client'
import { AuthorizationError, NotFoundError, ValidationError } from '@/shared/errors/domain-error'

/**
 * Tests para `markItemCompletedAction`.
 *
 * Cualquier miembro activo puede marcar (D3 ADR `2026-05-04`) **siempre
 * que tenga read-access a la categoría** — gate `assertCategoryReadable`
 * (Hallazgo #2, Plan A S3). Idempotente — si ya estaba completado,
 * retorna `alreadyCompleted: true` sin error.
 *
 * Mocks de boundary (no de la cadena interna de auth): `resolveLibraryViewer`
 * y `assertCategoryReadable` se mockean por su barrel — el test verifica
 * el contrato de la action, no cómo se resuelve el viewer internamente.
 */

const libraryItemFindUnique = vi.fn()
const libraryItemCompletionCreate = vi.fn()
const revalidatePathFn = vi.fn()
const resolveLibraryViewerFn = vi.fn()
const assertCategoryReadableFn = vi.fn()

vi.mock('@/db/client', () => ({
  prisma: {
    libraryItem: { findUnique: (...a: unknown[]) => libraryItemFindUnique(...a) },
    libraryItemCompletion: {
      create: (...a: unknown[]) => libraryItemCompletionCreate(...a),
    },
  },
}))

vi.mock('next/cache', () => ({
  unstable_cache: <T extends (...args: unknown[]) => unknown>(fn: T): T => fn,
  revalidatePath: (...a: unknown[]) => revalidatePathFn(...a),
}))

vi.mock('server-only', () => ({}))

vi.mock('@/features/library/public.server', () => ({
  resolveLibraryViewer: (...a: unknown[]) => resolveLibraryViewerFn(...a),
}))

vi.mock('@/features/library/access/public.server', () => ({
  assertCategoryReadable: (...a: unknown[]) => assertCategoryReadableFn(...a),
}))

import { markItemCompletedAction } from '../server/actions/mark-item-completed'

const PLACE_ID = 'place-1'
const PLACE_SLUG = 'the-place'
const CATEGORY_ID = 'cat-1'
const CATEGORY_SLUG = 'curso-x'
const ITEM_ID = 'item-1'
const ITEM_POST_SLUG = 'item-post-slug'
const ACTOR_ID = 'user-1'

function setupHappyMember(): void {
  libraryItemFindUnique.mockResolvedValue({
    id: ITEM_ID,
    placeId: PLACE_ID,
    categoryId: CATEGORY_ID,
    archivedAt: null,
    category: { slug: CATEGORY_SLUG },
    post: { slug: ITEM_POST_SLUG },
  })
  resolveLibraryViewerFn.mockResolvedValue({
    viewer: { userId: ACTOR_ID, isAdmin: false, isOwner: false, groupIds: [], tierIds: [] },
    actor: { actorId: ACTOR_ID, placeId: PLACE_ID, placeSlug: PLACE_SLUG },
  })
  assertCategoryReadableFn.mockResolvedValue(undefined)
  libraryItemCompletionCreate.mockResolvedValue({
    itemId: ITEM_ID,
    userId: ACTOR_ID,
    completedAt: new Date(),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('markItemCompletedAction — validación + auth + read-access', () => {
  it('rechaza input inválido con ValidationError', async () => {
    await expect(markItemCompletedAction({ itemId: '' })).rejects.toBeInstanceOf(ValidationError)
    expect(libraryItemFindUnique).not.toHaveBeenCalled()
  })

  it('rechaza item inexistente con NotFoundError', async () => {
    libraryItemFindUnique.mockResolvedValue(null)
    await expect(markItemCompletedAction({ itemId: 'item-x' })).rejects.toBeInstanceOf(
      NotFoundError,
    )
  })

  it('rechaza item archivado con NotFoundError', async () => {
    libraryItemFindUnique.mockResolvedValue({
      id: ITEM_ID,
      placeId: PLACE_ID,
      categoryId: CATEGORY_ID,
      archivedAt: new Date(),
      category: { slug: CATEGORY_SLUG },
      post: { slug: ITEM_POST_SLUG },
    })
    await expect(markItemCompletedAction({ itemId: ITEM_ID })).rejects.toBeInstanceOf(NotFoundError)
    expect(libraryItemCompletionCreate).not.toHaveBeenCalled()
  })

  it('rechaza si el viewer no tiene read-access (assertCategoryReadable throw)', async () => {
    setupHappyMember()
    assertCategoryReadableFn.mockRejectedValue(
      new AuthorizationError('No tenés acceso a esta categoría.', { categoryId: CATEGORY_ID }),
    )
    await expect(markItemCompletedAction({ itemId: ITEM_ID })).rejects.toBeInstanceOf(
      AuthorizationError,
    )
    expect(assertCategoryReadableFn).toHaveBeenCalledWith(CATEGORY_ID, expect.any(Object))
    expect(libraryItemCompletionCreate).not.toHaveBeenCalled()
  })
})

describe('markItemCompletedAction — happy path', () => {
  it('miembro con read-access marca por primera vez → alreadyCompleted: false', async () => {
    setupHappyMember()

    const result = await markItemCompletedAction({ itemId: ITEM_ID })

    expect(result).toEqual({ ok: true, alreadyCompleted: false })
    expect(assertCategoryReadableFn).toHaveBeenCalledWith(CATEGORY_ID, expect.any(Object))
    expect(libraryItemCompletionCreate).toHaveBeenCalledWith({
      data: { itemId: ITEM_ID, userId: ACTOR_ID },
    })
    expect(revalidatePathFn).toHaveBeenCalledWith(`/${PLACE_SLUG}/library/${CATEGORY_SLUG}`)
  })

  it('idempotencia: P2002 → alreadyCompleted: true', async () => {
    setupHappyMember()
    libraryItemCompletionCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    )

    const result = await markItemCompletedAction({ itemId: ITEM_ID })

    expect(result).toEqual({ ok: true, alreadyCompleted: true })
    expect(revalidatePathFn).toHaveBeenCalledWith(`/${PLACE_SLUG}/library/${CATEGORY_SLUG}`)
  })
})
