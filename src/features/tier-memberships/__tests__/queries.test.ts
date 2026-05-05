import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Tests de las queries del slice `tier-memberships` (M.2).
 *
 * Mockean Prisma con stubs por método. Verifican:
 *  - WHERE compuesto correcto (placeId, userId).
 *  - `include` explícito de tier (1 query, NO N+1).
 *  - Orden por `assignedAt DESC`.
 *  - Mapping de row + JSON snapshot a domain `TierMembershipDetail`.
 *  - Defensiveness: snapshot corrupted → placeholder "ex-asignador".
 */

const tierMembershipFindMany = vi.fn()

vi.mock('@/db/client', () => ({
  prisma: {
    tierMembership: {
      findMany: (...a: unknown[]) => tierMembershipFindMany(...a),
    },
  },
}))

vi.mock('server-only', () => ({}))

import {
  findActiveAssignmentsForMember,
  listAssignmentsByMember,
  listAssignmentsByPlace,
} from '../server/queries'

const PLACE_ID = 'place-1'
const USER_ID = 'user-1'
const TIER_ID = 'tier-1'
const TM_ID = 'tm-1'

const TIER_ROW = {
  id: TIER_ID,
  placeId: PLACE_ID,
  name: 'Premium',
  description: null,
  priceCents: 999,
  currency: 'USD',
  duration: 'ONE_MONTH' as const,
  visibility: 'PUBLISHED' as const,
  createdAt: new Date('2026-05-02T08:00:00Z'),
  updatedAt: new Date('2026-05-02T08:00:00Z'),
}

const TM_ROW_BASE = {
  id: TM_ID,
  tierId: TIER_ID,
  userId: USER_ID,
  placeId: PLACE_ID,
  assignedAt: new Date('2026-05-02T10:00:00Z'),
  assignedByUserId: 'owner-1',
  assignedBySnapshot: { displayName: 'Maxi', avatarUrl: null },
  expiresAt: new Date('2026-06-01T10:00:00Z'),
  updatedAt: new Date('2026-05-02T10:00:00Z'),
}

const TM_ROW_WITH_TIER = { ...TM_ROW_BASE, tier: TIER_ROW }

beforeEach(() => {
  vi.clearAllMocks()
})

describe('listAssignmentsByPlace', () => {
  it('arma WHERE { placeId } y ordena por assignedAt DESC', async () => {
    tierMembershipFindMany.mockResolvedValue([TM_ROW_BASE])

    const result = await listAssignmentsByPlace(PLACE_ID)

    expect(tierMembershipFindMany).toHaveBeenCalledTimes(1)
    const call = tierMembershipFindMany.mock.calls[0]?.[0] as {
      where: Record<string, unknown>
      orderBy: Record<string, unknown>
    }
    expect(call.where).toEqual({ placeId: PLACE_ID })
    expect(call.orderBy).toEqual({ assignedAt: 'desc' })
    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe(TM_ID)
  })

  it('lista vacía si no hay rows', async () => {
    tierMembershipFindMany.mockResolvedValue([])

    const result = await listAssignmentsByPlace(PLACE_ID)

    expect(result).toEqual([])
  })

  it('mapea snapshot JSON al shape AssignedBySnapshot', async () => {
    tierMembershipFindMany.mockResolvedValue([TM_ROW_BASE])

    const [tm] = await listAssignmentsByPlace(PLACE_ID)

    expect(tm?.assignedBySnapshot).toEqual({ displayName: 'Maxi', avatarUrl: null })
  })

  it('snapshot corrupted (null/no displayName) → placeholder "ex-asignador"', async () => {
    tierMembershipFindMany.mockResolvedValue([
      { ...TM_ROW_BASE, assignedBySnapshot: null },
      { ...TM_ROW_BASE, id: 'tm-2', assignedBySnapshot: { foo: 'bar' } },
    ])

    const result = await listAssignmentsByPlace(PLACE_ID)

    expect(result[0]?.assignedBySnapshot).toEqual({
      displayName: 'ex-asignador',
      avatarUrl: null,
    })
    expect(result[1]?.assignedBySnapshot).toEqual({
      displayName: 'ex-asignador',
      avatarUrl: null,
    })
  })
})

describe('listAssignmentsByMember', () => {
  it('1 query con include explícito de tier (NO N+1)', async () => {
    tierMembershipFindMany.mockResolvedValue([TM_ROW_WITH_TIER])

    await listAssignmentsByMember(USER_ID, PLACE_ID)

    expect(tierMembershipFindMany).toHaveBeenCalledTimes(1)
    const call = tierMembershipFindMany.mock.calls[0]?.[0] as {
      where: Record<string, unknown>
      orderBy: Record<string, unknown>
      select: Record<string, unknown>
    }
    expect(call.where).toEqual({ userId: USER_ID, placeId: PLACE_ID })
    expect(call.orderBy).toEqual({ assignedAt: 'desc' })
    // El select debe incluir el tier joined — sin esto sería N+1.
    expect(call.select.tier).toBeDefined()
  })

  it('hidrata el TierMembershipDetail con tier joined', async () => {
    tierMembershipFindMany.mockResolvedValue([TM_ROW_WITH_TIER])

    const [tm] = await listAssignmentsByMember(USER_ID, PLACE_ID)

    expect(tm?.tier.id).toBe(TIER_ID)
    expect(tm?.tier.name).toBe('Premium')
    expect(tm?.tier.duration).toBe('ONE_MONTH')
    expect(tm?.tier.visibility).toBe('PUBLISHED')
    expect(tm?.expiresAt).toEqual(TM_ROW_BASE.expiresAt)
  })

  it('expiresAt = null se preserva (asignación indefinida)', async () => {
    tierMembershipFindMany.mockResolvedValue([{ ...TM_ROW_WITH_TIER, expiresAt: null }])

    const [tm] = await listAssignmentsByMember(USER_ID, PLACE_ID)

    expect(tm?.expiresAt).toBeNull()
  })

  it('lista vacía si el miembro no tiene asignaciones', async () => {
    tierMembershipFindMany.mockResolvedValue([])

    const result = await listAssignmentsByMember(USER_ID, PLACE_ID)

    expect(result).toEqual([])
  })
})

describe('findActiveAssignmentsForMember', () => {
  it('alias de listAssignmentsByMember en v1 (sin filtro de expiresAt)', async () => {
    tierMembershipFindMany.mockResolvedValue([TM_ROW_WITH_TIER])

    const result = await findActiveAssignmentsForMember(USER_ID, PLACE_ID)

    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe(TM_ID)
    // v1 NO filtra por expiresAt — el WHERE es exactamente el mismo.
    const call = tierMembershipFindMany.mock.calls[0]?.[0] as {
      where: Record<string, unknown>
    }
    expect(call.where).toEqual({ userId: USER_ID, placeId: PLACE_ID })
  })
})
