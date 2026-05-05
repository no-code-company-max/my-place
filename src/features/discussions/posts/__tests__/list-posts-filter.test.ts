import { describe, expect, it, vi, beforeEach } from 'vitest'

const postFindMany = vi.fn()
const postReadGroupBy = vi.fn()
const postReadFindMany = vi.fn()
const commentGroupBy = vi.fn()
const findOrCreateOpeningMock = vi.fn()

vi.mock('@/db/client', () => ({
  prisma: {
    post: {
      findMany: (...a: unknown[]) => postFindMany(...a),
    },
    postRead: {
      groupBy: (...a: unknown[]) => postReadGroupBy(...a),
      findMany: (...a: unknown[]) => postReadFindMany(...a),
    },
    comment: {
      groupBy: (...a: unknown[]) => commentGroupBy(...a),
    },
  },
}))

vi.mock('../server/place-opening', () => ({
  findOrCreateCurrentOpening: (...a: unknown[]) => findOrCreateOpeningMock(...a),
}))

vi.mock('server-only', () => ({}))

vi.mock('@/shared/config/env', () => ({
  clientEnv: {
    NEXT_PUBLIC_APP_URL: 'http://lvh.me:3000',
    NEXT_PUBLIC_APP_DOMAIN: 'lvh.me:3000',
    NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
  },
  serverEnv: { SUPABASE_SERVICE_ROLE_KEY: 'service', NODE_ENV: 'test' },
}))

import { listPostsByPlace } from '@/features/discussions/posts/server/queries/posts'

beforeEach(() => {
  postFindMany.mockReset()
  postReadGroupBy.mockReset()
  postReadFindMany.mockReset()
  commentGroupBy.mockReset()
  findOrCreateOpeningMock.mockReset()
  findOrCreateOpeningMock.mockResolvedValue(null)
  commentGroupBy.mockResolvedValue([])
  postFindMany.mockResolvedValue([])
})

/**
 * Tests del filter param de `listPostsByPlace`. Los 3 cases del
 * R.6 follow-up:
 *  - all: sin filter adicional al where.
 *  - unanswered: where.comments.none.deletedAt = null.
 *  - participating: where.OR con authorUserId + comments.some.
 *
 * No testeamos el resultado real (Prisma queries son mockeadas) sino
 * que el WHERE construido se le pasa correctamente a `findMany`.
 */
describe('listPostsByPlace — filter param', () => {
  function getWhereArg(): Record<string, unknown> {
    expect(postFindMany).toHaveBeenCalled()
    const callArg = postFindMany.mock.calls[0]?.[0] as { where: Record<string, unknown> }
    return callArg.where
  }

  describe('filter="all" (default)', () => {
    it('no agrega clauses de comments al where', async () => {
      await listPostsByPlace({ placeId: 'place-1' })
      const where = getWhereArg()
      expect(where).not.toHaveProperty('comments')
      expect(where).not.toHaveProperty('OR')
    })

    it('explícito filter="all" → mismo comportamiento que default', async () => {
      await listPostsByPlace({ placeId: 'place-1', filter: 'all' })
      const where = getWhereArg()
      expect(where).not.toHaveProperty('comments')
    })
  })

  describe('filter="unanswered"', () => {
    it('agrega comments.none.deletedAt=null al where', async () => {
      await listPostsByPlace({ placeId: 'place-1', filter: 'unanswered' })
      const where = getWhereArg()
      expect(where.comments).toEqual({ none: { deletedAt: null } })
    })

    it('NO requiere viewerUserId (filter funciona anónimo)', async () => {
      await listPostsByPlace({ placeId: 'place-1', filter: 'unanswered' })
      expect(postFindMany).toHaveBeenCalled()
    })
  })

  describe('filter="participating"', () => {
    it('agrega OR(authorUserId, comments.some) al where con viewerUserId', async () => {
      await listPostsByPlace({
        placeId: 'place-1',
        filter: 'participating',
        viewerUserId: 'user-42',
      })
      const where = getWhereArg()
      expect(where.OR).toEqual([
        { authorUserId: 'user-42' },
        { comments: { some: { authorUserId: 'user-42', deletedAt: null } } },
      ])
    })

    it('SIN viewerUserId → devuelve lista vacía sin invocar Prisma', async () => {
      const result = await listPostsByPlace({
        placeId: 'place-1',
        filter: 'participating',
        // viewerUserId omitido — defensivo
      })
      expect(result).toEqual({ items: [], nextCursor: null })
      expect(postFindMany).not.toHaveBeenCalled()
    })
  })

  describe('filter combinado con cursor', () => {
    it('cursor + filter unanswered: ambos clauses presentes', async () => {
      const cursorDate = new Date('2026-04-26T10:00:00Z')
      await listPostsByPlace({
        placeId: 'place-1',
        cursor: { createdAt: cursorDate, id: 'last-post-id' },
        filter: 'unanswered',
      })
      const where = getWhereArg()
      // Ambos: cursor OR + filter comments.none coexisten
      expect(where).toHaveProperty('OR')
      expect(where).toHaveProperty('comments')
      expect(where.comments).toEqual({ none: { deletedAt: null } })
    })
  })

  describe('placeId + hiddenAt siguen funcionando con filter', () => {
    it('default (no admin) + filter unanswered: hiddenAt=null + comments.none', async () => {
      await listPostsByPlace({ placeId: 'place-1', filter: 'unanswered' })
      const where = getWhereArg()
      expect(where.placeId).toBe('place-1')
      expect(where.hiddenAt).toBe(null)
      expect(where.comments).toEqual({ none: { deletedAt: null } })
    })

    it('includeHidden=true + filter participating: sin hiddenAt clause + OR', async () => {
      await listPostsByPlace({
        placeId: 'place-1',
        includeHidden: true,
        filter: 'participating',
        viewerUserId: 'user-7',
      })
      const where = getWhereArg()
      expect(where.placeId).toBe('place-1')
      expect(where.hiddenAt).toBeUndefined()
      expect(where).toHaveProperty('OR')
    })
  })
})
