import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Tests de las queries del slice `tiers` (T.2).
 *
 * Mockean Prisma con stubs por método. Verifican:
 *  - El gate explícito por `viewerIsOwner` afecta el WHERE clause
 *    (sin owner, filtra a `visibility = PUBLISHED`).
 *  - `findTierById` retorna `null` si el viewer no es owner y el tier
 *    es HIDDEN — evita enumeración por id.
 *  - El mapping de Prisma row a domain `Tier` preserva todos los campos.
 */

const tierFindMany = vi.fn()
const tierFindUnique = vi.fn()

vi.mock('@/db/client', () => ({
  prisma: {
    tier: {
      findMany: (...a: unknown[]) => tierFindMany(...a),
      findUnique: (...a: unknown[]) => tierFindUnique(...a),
    },
  },
}))

vi.mock('server-only', () => ({}))

import { findTierById, listTiersByPlace } from '../server/queries'

const PLACE_ID = 'place-1'
const TIER_ID = 'tier-1'

const TIER_ROW = {
  id: TIER_ID,
  placeId: PLACE_ID,
  name: 'Básico',
  description: 'Acceso básico al place.',
  priceCents: 199,
  currency: 'USD',
  duration: 'ONE_MONTH' as const,
  visibility: 'PUBLISHED' as const,
  createdAt: new Date('2026-05-02T10:00:00Z'),
  updatedAt: new Date('2026-05-02T10:00:00Z'),
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('listTiersByPlace', () => {
  it('owner ve todos los tiers (sin filtro de visibility)', async () => {
    tierFindMany.mockResolvedValue([TIER_ROW])

    const result = await listTiersByPlace(PLACE_ID, true)

    expect(tierFindMany).toHaveBeenCalledTimes(1)
    const call = tierFindMany.mock.calls[0]?.[0] as { where: Record<string, unknown> }
    expect(call.where).toEqual({ placeId: PLACE_ID })
    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe(TIER_ID)
  })

  it('non-owner sólo ve tiers PUBLISHED (WHERE visibility="PUBLISHED")', async () => {
    tierFindMany.mockResolvedValue([])

    await listTiersByPlace(PLACE_ID, false)

    const call = tierFindMany.mock.calls[0]?.[0] as { where: Record<string, unknown> }
    expect(call.where).toEqual({ placeId: PLACE_ID, visibility: 'PUBLISHED' })
  })

  it('ordena por createdAt DESC (los nuevos arriba)', async () => {
    tierFindMany.mockResolvedValue([])

    await listTiersByPlace(PLACE_ID, true)

    const call = tierFindMany.mock.calls[0]?.[0] as { orderBy: Record<string, unknown> }
    expect(call.orderBy).toEqual({ createdAt: 'desc' })
  })

  it('mapea row a domain Tier preservando todos los campos', async () => {
    tierFindMany.mockResolvedValue([TIER_ROW])

    const [tier] = await listTiersByPlace(PLACE_ID, true)

    expect(tier).toEqual({
      id: TIER_ROW.id,
      placeId: TIER_ROW.placeId,
      name: TIER_ROW.name,
      description: TIER_ROW.description,
      priceCents: TIER_ROW.priceCents,
      currency: TIER_ROW.currency,
      duration: TIER_ROW.duration,
      visibility: TIER_ROW.visibility,
      createdAt: TIER_ROW.createdAt,
      updatedAt: TIER_ROW.updatedAt,
    })
  })

  it('retorna lista vacía si no hay tiers', async () => {
    tierFindMany.mockResolvedValue([])

    const result = await listTiersByPlace(PLACE_ID, true)

    expect(result).toEqual([])
  })
})

describe('findTierById', () => {
  it('owner ve el tier sea PUBLISHED o HIDDEN', async () => {
    tierFindUnique.mockResolvedValue({ ...TIER_ROW, visibility: 'HIDDEN' as const })

    const result = await findTierById(TIER_ID, true)

    expect(result).not.toBeNull()
    expect(result?.visibility).toBe('HIDDEN')
  })

  it('non-owner ve el tier si está PUBLISHED', async () => {
    tierFindUnique.mockResolvedValue(TIER_ROW)

    const result = await findTierById(TIER_ID, false)

    expect(result).not.toBeNull()
    expect(result?.visibility).toBe('PUBLISHED')
  })

  it('non-owner NO ve el tier si está HIDDEN — retorna null (evita enumeración)', async () => {
    tierFindUnique.mockResolvedValue({ ...TIER_ROW, visibility: 'HIDDEN' as const })

    const result = await findTierById(TIER_ID, false)

    expect(result).toBeNull()
  })

  it('retorna null si el tier no existe', async () => {
    tierFindUnique.mockResolvedValue(null)

    const result = await findTierById('inexistent', true)

    expect(result).toBeNull()
  })
})
