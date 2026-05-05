import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Tests para `findReadScope(categoryId)` — query del sub-slice
 * `library/access`. Una query con includes (sin N+1) que retorna el
 * shape canónico `{ kind, groupIds, tierIds, userIds }`.
 */

const libraryCategoryFindUnique = vi.fn()

vi.mock('@/db/client', () => ({
  prisma: {
    libraryCategory: { findUnique: (...a: unknown[]) => libraryCategoryFindUnique(...a) },
  },
}))
vi.mock('server-only', () => ({}))

import { findReadScope } from '../server/queries'

const CATEGORY_ID = 'cat-1'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('findReadScope', () => {
  it('retorna null si la categoría no existe', async () => {
    libraryCategoryFindUnique.mockResolvedValue(null)
    const result = await findReadScope(CATEGORY_ID)
    expect(result).toBeNull()
  })

  it('PUBLIC sin scopes: arrays vacíos', async () => {
    libraryCategoryFindUnique.mockResolvedValue({
      readAccessKind: 'PUBLIC',
      readGroupScopes: [],
      readTierScopes: [],
      readUserScopes: [],
    })
    const result = await findReadScope(CATEGORY_ID)
    expect(result).toEqual({
      kind: 'PUBLIC',
      groupIds: [],
      tierIds: [],
      userIds: [],
    })
  })

  it('GROUPS con scopes pobladas: retorna sólo groupIds', async () => {
    libraryCategoryFindUnique.mockResolvedValue({
      readAccessKind: 'GROUPS',
      readGroupScopes: [{ groupId: 'grp-a' }, { groupId: 'grp-b' }],
      readTierScopes: [],
      readUserScopes: [],
    })
    const result = await findReadScope(CATEGORY_ID)
    expect(result).toEqual({
      kind: 'GROUPS',
      groupIds: ['grp-a', 'grp-b'],
      tierIds: [],
      userIds: [],
    })
  })

  it('TIERS con scopes pobladas: retorna sólo tierIds', async () => {
    libraryCategoryFindUnique.mockResolvedValue({
      readAccessKind: 'TIERS',
      readGroupScopes: [],
      readTierScopes: [{ tierId: 'tier-x' }, { tierId: 'tier-y' }],
      readUserScopes: [],
    })
    const result = await findReadScope(CATEGORY_ID)
    expect(result).toEqual({
      kind: 'TIERS',
      groupIds: [],
      tierIds: ['tier-x', 'tier-y'],
      userIds: [],
    })
  })

  it('USERS con scopes pobladas: retorna sólo userIds', async () => {
    libraryCategoryFindUnique.mockResolvedValue({
      readAccessKind: 'USERS',
      readGroupScopes: [],
      readTierScopes: [],
      readUserScopes: [{ userId: 'user-1' }, { userId: 'user-2' }],
    })
    const result = await findReadScope(CATEGORY_ID)
    expect(result).toEqual({
      kind: 'USERS',
      groupIds: [],
      tierIds: [],
      userIds: ['user-1', 'user-2'],
    })
  })

  it('hace 1 query con includes — sin N+1', async () => {
    libraryCategoryFindUnique.mockResolvedValue({
      readAccessKind: 'PUBLIC',
      readGroupScopes: [],
      readTierScopes: [],
      readUserScopes: [],
    })
    await findReadScope(CATEGORY_ID)
    expect(libraryCategoryFindUnique).toHaveBeenCalledTimes(1)
    expect(libraryCategoryFindUnique).toHaveBeenCalledWith({
      where: { id: CATEGORY_ID },
      select: {
        readAccessKind: true,
        readGroupScopes: { select: { groupId: true } },
        readTierScopes: { select: { tierId: true } },
        readUserScopes: { select: { userId: true } },
      },
    })
  })
})
