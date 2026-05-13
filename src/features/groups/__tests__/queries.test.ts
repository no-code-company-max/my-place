import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Tests de las queries del slice `groups` (G.2).
 *
 * Mockean Prisma con stubs por método. Verifican:
 *  - WHERE compuesto correcto (placeId, groupId, userId).
 *  - Mapping de row → domain (incluye dedupe de permisos legacy).
 *  - Orden esperado (preset primero, después createdAt asc).
 */

const permissionGroupFindMany = vi.fn()
const permissionGroupFindUnique = vi.fn()
const groupMembershipFindMany = vi.fn()

vi.mock('@/db/client', () => ({
  prisma: {
    permissionGroup: {
      findMany: (...a: unknown[]) => permissionGroupFindMany(...a),
      findUnique: (...a: unknown[]) => permissionGroupFindUnique(...a),
    },
    groupMembership: {
      findMany: (...a: unknown[]) => groupMembershipFindMany(...a),
    },
  },
}))

vi.mock('server-only', () => ({}))

import {
  findGroupById,
  listGroupsByPlace,
  listGroupsForUser,
  listMembershipsByGroup,
} from '../server/queries'

const PLACE_ID = 'place-1'
const GROUP_ID = 'grp-1'
const USER_ID = 'user-1'

const RAW_GROUP_ROW = {
  id: GROUP_ID,
  placeId: PLACE_ID,
  name: 'Moderadores',
  description: 'Mods de discusiones',
  permissions: ['flags:review', 'discussions:hide-post', 'unknown:foo'],
  isPreset: false,
  createdAt: new Date('2026-05-02T10:00:00Z'),
  updatedAt: new Date('2026-05-02T10:00:00Z'),
  _count: { groupMemberships: 3 },
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('listGroupsByPlace', () => {
  it('arma WHERE { placeId } y ordena preset primero, después createdAt asc', async () => {
    permissionGroupFindMany.mockResolvedValue([RAW_GROUP_ROW])

    await listGroupsByPlace(PLACE_ID)

    expect(permissionGroupFindMany).toHaveBeenCalledTimes(1)
    const call = permissionGroupFindMany.mock.calls[0]?.[0] as {
      where: Record<string, unknown>
      orderBy: Array<Record<string, unknown>>
    }
    expect(call.where).toEqual({ placeId: PLACE_ID })
    expect(call.orderBy).toEqual([{ isPreset: 'desc' }, { createdAt: 'asc' }])
  })

  it('mapea row → domain con dedupe de permisos legacy inválidos', async () => {
    permissionGroupFindMany.mockResolvedValue([RAW_GROUP_ROW])

    const [grp] = await listGroupsByPlace(PLACE_ID)

    expect(grp?.id).toBe(GROUP_ID)
    expect(grp?.permissions).toEqual(['flags:review', 'discussions:hide-post'])
    expect(grp?.memberCount).toBe(3)
  })

  it('lista vacía si no hay grupos', async () => {
    permissionGroupFindMany.mockResolvedValue([])
    expect(await listGroupsByPlace(PLACE_ID)).toEqual([])
  })
})

describe('findGroupById', () => {
  it('devuelve el grupo mapeado cuando existe', async () => {
    permissionGroupFindUnique.mockResolvedValue(RAW_GROUP_ROW)

    const grp = await findGroupById(GROUP_ID)

    expect(grp?.id).toBe(GROUP_ID)
    expect(grp?.permissions.length).toBe(2)
    const call = permissionGroupFindUnique.mock.calls[0]?.[0] as {
      where: Record<string, unknown>
    }
    expect(call.where).toEqual({ id: GROUP_ID })
  })

  it('null si no existe', async () => {
    permissionGroupFindUnique.mockResolvedValue(null)
    // Usamos un id distinto para no chocar con el cache de React.cache
    expect(await findGroupById('grp-missing')).toBeNull()
  })
})

describe('listGroupsForUser', () => {
  it('proyecta el shape liviano GroupSummary', async () => {
    groupMembershipFindMany.mockResolvedValue([
      {
        group: { id: 'grp-a', name: 'Mods', isPreset: false },
      },
      {
        group: { id: 'grp-preset', name: 'Administradores', isPreset: true },
      },
    ])

    const result = await listGroupsForUser(USER_ID, PLACE_ID)

    expect(result).toEqual([
      { id: 'grp-a', name: 'Mods', isPreset: false },
      { id: 'grp-preset', name: 'Administradores', isPreset: true },
    ])
    const call = groupMembershipFindMany.mock.calls[0]?.[0] as {
      where: Record<string, unknown>
      orderBy: Record<string, unknown>
    }
    expect(call.where).toEqual({ userId: USER_ID, placeId: PLACE_ID })
    expect(call.orderBy).toEqual({ addedAt: 'asc' })
  })

  it('vacío si user no está en ningún grupo', async () => {
    groupMembershipFindMany.mockResolvedValue([])
    expect(await listGroupsForUser(USER_ID, PLACE_ID)).toEqual([])
  })
})

describe('listMembershipsByGroup', () => {
  it('mapea rows con user joined y ordena por addedAt asc', async () => {
    groupMembershipFindMany.mockResolvedValue([
      {
        id: 'gm-1',
        groupId: GROUP_ID,
        userId: USER_ID,
        placeId: PLACE_ID,
        addedAt: new Date('2026-05-02T10:00:00Z'),
        addedByUserId: 'owner-1',
        user: { displayName: 'Maxi', handle: 'maxi', avatarUrl: null },
      },
    ])

    const result = await listMembershipsByGroup(GROUP_ID)

    expect(result).toHaveLength(1)
    expect(result[0]?.user.displayName).toBe('Maxi')
    const call = groupMembershipFindMany.mock.calls[0]?.[0] as {
      where: Record<string, unknown>
      orderBy: Record<string, unknown>
    }
    expect(call.where).toEqual({ groupId: GROUP_ID })
    expect(call.orderBy).toEqual({ addedAt: 'asc' })
  })
})
