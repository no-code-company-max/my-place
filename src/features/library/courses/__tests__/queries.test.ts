import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Tests para queries del sub-slice library/courses (G.3.a).
 *
 *   - listCompletedItemIdsByUser: filtra por userId + placeId, retorna ids.
 *   - findItemPrereqChain: pure, cubre cadenas válidas, vacía, ciclo defensivo.
 */

const libraryItemCompletionFindMany = vi.fn()
const libraryItemFindMany = vi.fn()

vi.mock('@/db/client', () => ({
  prisma: {
    libraryItemCompletion: {
      findMany: (...a: unknown[]) => libraryItemCompletionFindMany(...a),
    },
    libraryItem: {
      findMany: (...a: unknown[]) => libraryItemFindMany(...a),
    },
  },
}))

vi.mock('server-only', () => ({}))

import {
  findItemPrereqChain,
  listCategoryItemsForPrereqLookup,
  listCompletedItemIdsByUser,
  type ItemForPrereqChain,
} from '../server/queries'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('listCompletedItemIdsByUser', () => {
  it('retorna ids vacíos si el user no marcó nada', async () => {
    libraryItemCompletionFindMany.mockResolvedValue([])
    const result = await listCompletedItemIdsByUser('u-1', 'p-1')
    expect(result).toEqual([])
    expect(libraryItemCompletionFindMany).toHaveBeenCalledWith({
      where: { userId: 'u-1', item: { placeId: 'p-1' } },
      select: { itemId: true },
    })
  })

  it('retorna lista de ids cuando hay completions', async () => {
    libraryItemCompletionFindMany.mockResolvedValue([
      { itemId: 'item-A' },
      { itemId: 'item-B' },
      { itemId: 'item-C' },
    ])
    const result = await listCompletedItemIdsByUser('u-1', 'p-1')
    expect(result).toEqual(['item-A', 'item-B', 'item-C'])
  })

  it('filtra por placeId — defense in depth para no leakear cross-place', async () => {
    libraryItemCompletionFindMany.mockResolvedValue([{ itemId: 'item-A' }])
    await listCompletedItemIdsByUser('u-1', 'p-other')
    expect(libraryItemCompletionFindMany).toHaveBeenCalledWith({
      where: { userId: 'u-1', item: { placeId: 'p-other' } },
      select: { itemId: true },
    })
  })
})

function buildLookup(
  entries: ReadonlyArray<readonly [string, string | null]>,
): ReadonlyMap<string, ItemForPrereqChain> {
  const map = new Map<string, ItemForPrereqChain>()
  for (const [id, prereq] of entries) {
    map.set(id, { id, prereqItemId: prereq })
  }
  return map
}

describe('findItemPrereqChain', () => {
  it('item sin prereq → []', () => {
    const lookup = buildLookup([['A', null]])
    expect(findItemPrereqChain('A', lookup)).toEqual([])
  })

  it('item inexistente en lookup → []', () => {
    const lookup = buildLookup([['A', null]])
    expect(findItemPrereqChain('Z', lookup)).toEqual([])
  })

  it('cadena de 1 nivel: B→A → [{id:A}]', () => {
    const lookup = buildLookup([
      ['A', null],
      ['B', 'A'],
    ])
    expect(findItemPrereqChain('B', lookup)).toEqual([{ id: 'A' }])
  })

  it('cadena profunda: D→C→B→A → [C, B, A]', () => {
    const lookup = buildLookup([
      ['A', null],
      ['B', 'A'],
      ['C', 'B'],
      ['D', 'C'],
    ])
    expect(findItemPrereqChain('D', lookup)).toEqual([{ id: 'C' }, { id: 'B' }, { id: 'A' }])
  })

  it('cadena con prereq referenciando id inexistente → corta cuando no encuentra el next', () => {
    const lookup = buildLookup([
      ['B', 'A-MISSING'],
      // 'A-MISSING' no está en el lookup → recorre B → A-MISSING; no
      // encuentra el next, agrega A-MISSING al chain y termina.
    ])
    expect(findItemPrereqChain('B', lookup)).toEqual([{ id: 'A-MISSING' }])
  })

  it('ciclo en data corrupta: B→A→B → corta defensivamente sin loop', () => {
    // Caso pathológico — no debería pasar en producción (set-item-prereq
    // valida no-ciclo antes de UPDATE). Pero si el state es inconsistente,
    // no queremos loop infinito al renderizar.
    const lookup = buildLookup([
      ['A', 'B'],
      ['B', 'A'],
    ])
    const result = findItemPrereqChain('B', lookup)
    // Empieza en B, sigue → A, agrega A; next = B (visited) → break.
    expect(result).toEqual([{ id: 'A' }])
  })
})

describe('listCategoryItemsForPrereqLookup', () => {
  it('retorna lista vacía si la categoría no tiene items', async () => {
    libraryItemFindMany.mockResolvedValue([])
    const result = await listCategoryItemsForPrereqLookup('cat-1', 'p-1')
    expect(result).toEqual([])
    expect(libraryItemFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { categoryId: 'cat-1', placeId: 'p-1', archivedAt: null },
        orderBy: { createdAt: 'asc' },
      }),
    )
  })

  it('mapea cada row con title + slug del Post + prereqItemId', async () => {
    libraryItemFindMany.mockResolvedValue([
      {
        id: 'item-a',
        prereqItemId: null,
        post: { title: 'Galletas de chocolate', slug: 'galletas-de-chocolate' },
      },
      {
        id: 'item-b',
        prereqItemId: 'item-a',
        post: { title: 'Postres cheesecake', slug: 'postres-cheesecake' },
      },
    ])
    const result = await listCategoryItemsForPrereqLookup('cat-1', 'p-1')
    expect(result).toEqual([
      {
        id: 'item-a',
        title: 'Galletas de chocolate',
        postSlug: 'galletas-de-chocolate',
        prereqItemId: null,
      },
      {
        id: 'item-b',
        title: 'Postres cheesecake',
        postSlug: 'postres-cheesecake',
        prereqItemId: 'item-a',
      },
    ])
  })

  it('filtro `archivedAt: null` excluye items archivados', async () => {
    libraryItemFindMany.mockResolvedValue([])
    await listCategoryItemsForPrereqLookup('cat-1', 'p-1')
    const call = libraryItemFindMany.mock.calls[0]?.[0] as { where: Record<string, unknown> }
    expect(call.where.archivedAt).toBeNull()
  })
})
