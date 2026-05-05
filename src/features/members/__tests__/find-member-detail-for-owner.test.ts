import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Tests de `findMemberDetailForOwner` (M.3).
 *
 * Foco crítico (gotcha CLAUDE.md connection_limit):
 *  - Exactamente 2 queries Prisma: `membership.findFirst` (con include
 *    anidado de user.tierMemberships → tier) + `placeOwnership.findUnique`.
 *  - NO N queries por tier — el include trae todo en 1 round-trip.
 *  - NO selecciona `user.email` (privacidad — decisión #6 ADR).
 *  - Retorna null si la membership no existe o si el user dejó el place
 *    (`leftAt` no nulo → el findFirst con `leftAt: null` no matchea).
 */

const membershipFindFirst = vi.fn()
const ownershipFindUnique = vi.fn()
// C.1: `findMemberDetailForOwner` agrega 3ra query a `groupMembership.findFirst`
// para derivar `isAdmin`. Default = `null` (target no es admin).
const groupMembershipFindFirst = vi.fn(async (..._a: unknown[]) => null as { id: string } | null)

vi.mock('@/db/client', () => ({
  prisma: {
    membership: {
      findFirst: (...a: unknown[]) => membershipFindFirst(...a),
    },
    placeOwnership: {
      findUnique: (...a: unknown[]) => ownershipFindUnique(...a),
    },
    groupMembership: {
      findFirst: (...a: unknown[]) => groupMembershipFindFirst(...a),
    },
  },
}))

vi.mock('server-only', () => ({}))

// La cadena de imports de queries.ts atraviesa supabase/server (vía
// re-exports de tests adyacentes en la misma suite). Mock del env
// previene parse eager de Zod sobre process.env vacío en CI/test.
vi.mock('@/shared/config/env', () => ({
  serverEnv: { NODE_ENV: 'test' },
  clientEnv: {
    NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
    NEXT_PUBLIC_APP_URL: 'http://lvh.me:3000',
    NEXT_PUBLIC_APP_DOMAIN: 'lvh.me:3000',
  },
}))

import { findMemberDetailForOwner } from '../directory/server/directory-queries'

const USER_ID = 'user-target'
const PLACE_ID = 'place-1'

beforeEach(() => {
  membershipFindFirst.mockReset()
  ownershipFindUnique.mockReset()
  groupMembershipFindFirst.mockReset()
  groupMembershipFindFirst.mockResolvedValue(null)
})

describe('findMemberDetailForOwner', () => {
  it('retorna null si el userId no es miembro activo (membership=null)', async () => {
    membershipFindFirst.mockResolvedValue(null)
    ownershipFindUnique.mockResolvedValue(null)

    const result = await findMemberDetailForOwner(USER_ID, PLACE_ID)
    expect(result).toBeNull()
  })

  it('retorna null si el user dejó el place (leftAt no nulo → findFirst no matchea por where)', async () => {
    // El where filtra `leftAt: null`. Si el user dejó el place, Prisma retorna null.
    membershipFindFirst.mockResolvedValue(null)
    ownershipFindUnique.mockResolvedValue(null)

    const result = await findMemberDetailForOwner(USER_ID, PLACE_ID)
    expect(result).toBeNull()

    const call = membershipFindFirst.mock.calls[0]?.[0] as { where: Record<string, unknown> }
    expect(call.where).toEqual({ userId: USER_ID, placeId: PLACE_ID, leftAt: null })
  })

  it('happy path miembro simple sin tiers ni ownership', async () => {
    membershipFindFirst.mockResolvedValue({
      id: 'mem-1',
      joinedAt: new Date('2026-01-01T00:00:00Z'),
      user: {
        displayName: 'Ana',
        handle: 'ana',
        avatarUrl: null,
        tierMemberships: [],
      },
    })
    ownershipFindUnique.mockResolvedValue(null)

    const result = await findMemberDetailForOwner(USER_ID, PLACE_ID)

    expect(result).toEqual({
      userId: USER_ID,
      membershipId: 'mem-1',
      joinedAt: new Date('2026-01-01T00:00:00Z'),
      isOwner: false,
      isAdmin: false,
      user: { displayName: 'Ana', handle: 'ana', avatarUrl: null },
      tierMemberships: [],
    })
  })

  it('happy path con tiers asignados — mapping correcto del shape AssignedTierSummary', async () => {
    membershipFindFirst.mockResolvedValue({
      id: 'mem-1',
      joinedAt: new Date('2026-01-01T00:00:00Z'),
      user: {
        displayName: 'Maxi',
        handle: 'max',
        avatarUrl: 'https://x/y.jpg',
        tierMemberships: [
          {
            id: 'tm-1',
            tierId: 'tier-free',
            expiresAt: null,
            tier: { name: 'Colaboradores', visibility: 'PUBLISHED' },
          },
          {
            id: 'tm-2',
            tierId: 'tier-prem',
            expiresAt: new Date('2027-01-01T00:00:00Z'),
            tier: { name: 'Premium', visibility: 'HIDDEN' },
          },
        ],
      },
    })
    ownershipFindUnique.mockResolvedValue(null)

    const result = await findMemberDetailForOwner(USER_ID, PLACE_ID)

    expect(result?.tierMemberships).toEqual([
      {
        tierMembershipId: 'tm-1',
        tierId: 'tier-free',
        tierName: 'Colaboradores',
        tierVisibility: 'PUBLISHED',
        expiresAt: null,
      },
      {
        tierMembershipId: 'tm-2',
        tierId: 'tier-prem',
        tierName: 'Premium',
        tierVisibility: 'HIDDEN',
        expiresAt: new Date('2027-01-01T00:00:00Z'),
      },
    ])
  })

  it('isOwner=true cuando hay PlaceOwnership', async () => {
    membershipFindFirst.mockResolvedValue({
      id: 'mem-1',
      joinedAt: new Date('2025-01-01T00:00:00Z'),
      user: {
        displayName: 'Owner',
        handle: null,
        avatarUrl: null,
        tierMemberships: [],
      },
    })
    ownershipFindUnique.mockResolvedValue({ userId: USER_ID })

    const result = await findMemberDetailForOwner(USER_ID, PLACE_ID)
    expect(result?.isOwner).toBe(true)
  })

  it('CRITICAL — exactamente 3 queries Prisma (sin N+1 sobre tiers)', async () => {
    // Aunque el miembro tenga 5 tiers, el include anidado los trae todos en
    // 1 round-trip (parte del findFirst). Las otras 2 queries son ownership
    // y groupMembership (preset, post-C.1 para `isAdmin`).
    // Total: 3 queries, sin importar cuántos tiers tiene.
    membershipFindFirst.mockResolvedValue({
      id: 'mem-1',
      joinedAt: new Date(),
      user: {
        displayName: 'X',
        handle: null,
        avatarUrl: null,
        tierMemberships: Array.from({ length: 5 }).map((_, i) => ({
          id: `tm-${i}`,
          tierId: `tier-${i}`,
          expiresAt: null,
          tier: { name: `Tier ${i}`, visibility: 'PUBLISHED' as const },
        })),
      },
    })
    ownershipFindUnique.mockResolvedValue(null)

    await findMemberDetailForOwner(USER_ID, PLACE_ID)

    expect(membershipFindFirst).toHaveBeenCalledTimes(1)
    expect(ownershipFindUnique).toHaveBeenCalledTimes(1)
    expect(groupMembershipFindFirst).toHaveBeenCalledTimes(1)
  })

  it('NO selecciona user.email (privacidad — decisión #6 ADR)', async () => {
    membershipFindFirst.mockResolvedValue(null)
    ownershipFindUnique.mockResolvedValue(null)

    await findMemberDetailForOwner(USER_ID, PLACE_ID)

    const call = membershipFindFirst.mock.calls[0]?.[0] as { select: Record<string, unknown> }
    const userSelect = (call.select.user as { select: Record<string, unknown> }).select
    expect(userSelect.email).toBeUndefined()
    expect(userSelect.displayName).toBe(true)
    expect(userSelect.handle).toBe(true)
    expect(userSelect.avatarUrl).toBe(true)
  })

  it('include de user.tierMemberships filtra por placeId — no leak de tiers de otros places', async () => {
    membershipFindFirst.mockResolvedValue(null)
    ownershipFindUnique.mockResolvedValue(null)

    await findMemberDetailForOwner(USER_ID, PLACE_ID)

    const call = membershipFindFirst.mock.calls[0]?.[0] as { select: Record<string, unknown> }
    const userSelect = (call.select.user as { select: Record<string, unknown> }).select
    const tmSelect = userSelect.tierMemberships as { where: Record<string, unknown> }
    expect(tmSelect.where).toEqual({ placeId: PLACE_ID })
  })

  it('ownership lookup usa la unique (userId, placeId)', async () => {
    membershipFindFirst.mockResolvedValue(null)
    ownershipFindUnique.mockResolvedValue(null)

    await findMemberDetailForOwner(USER_ID, PLACE_ID)

    const call = ownershipFindUnique.mock.calls[0]?.[0] as { where: Record<string, unknown> }
    expect(call.where).toEqual({
      userId_placeId: { userId: USER_ID, placeId: PLACE_ID },
    })
  })
})
