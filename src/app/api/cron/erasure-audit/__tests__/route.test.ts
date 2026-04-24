import { beforeEach, describe, expect, it, vi } from 'vitest'

const { membershipCount, getEnv, loggerWarn, loggerInfo } = vi.hoisted(() => ({
  membershipCount: vi.fn(),
  getEnv: vi.fn<() => { CRON_SECRET: string | undefined }>(),
  loggerWarn: vi.fn(),
  loggerInfo: vi.fn(),
}))

vi.mock('server-only', () => ({}))

vi.mock('@/db/client', () => ({
  prisma: {
    membership: { count: (...a: unknown[]) => membershipCount(...a) },
  },
}))

vi.mock('@/shared/config/env', () => ({
  serverEnv: new Proxy(
    {},
    {
      get(_target, key) {
        if (key === 'CRON_SECRET') return getEnv().CRON_SECRET
        return undefined
      },
    },
  ),
}))

vi.mock('@/shared/lib/logger', () => ({
  logger: { warn: loggerWarn, info: loggerInfo, error: vi.fn(), debug: vi.fn() },
}))

import { GET } from '../route'

const VALID_SECRET = 'a'.repeat(32)

function mkReq(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/cron/erasure-audit', {
    method: 'GET',
    headers: { ...headers },
  })
}

beforeEach(() => {
  membershipCount.mockReset()
  getEnv.mockReset()
  loggerWarn.mockReset()
  loggerInfo.mockReset()
  getEnv.mockReturnValue({ CRON_SECRET: VALID_SECRET })
})

describe('GET /api/cron/erasure-audit', () => {
  it('401 sin secret correcto', async () => {
    const res = await GET(mkReq() as never)
    expect(res.status).toBe(401)
    expect(membershipCount).not.toHaveBeenCalled()
  })

  it('200 con backlog=0: loguea info "sin backlog"', async () => {
    membershipCount.mockResolvedValue(0)
    const res = await GET(mkReq({ authorization: `Bearer ${VALID_SECRET}` }) as never)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, backlog: 0 })
    expect(loggerInfo).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'erasureAuditClean' }),
      expect.any(String),
    )
    expect(loggerWarn).not.toHaveBeenCalled()
  })

  it('200 con backlog>0: loguea warn con count', async () => {
    membershipCount.mockResolvedValue(7)
    const res = await GET(mkReq({ authorization: `Bearer ${VALID_SECRET}` }) as never)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, backlog: 7 })
    expect(loggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'erasureBacklog', count: 7 }),
      expect.any(String),
    )
  })

  it('count query filtra cutoff 365d + erasureAppliedAt null + place activo', async () => {
    membershipCount.mockResolvedValue(0)
    await GET(mkReq({ authorization: `Bearer ${VALID_SECRET}` }) as never)

    expect(membershipCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          leftAt: expect.objectContaining({ lt: expect.any(Date) }),
          erasureAppliedAt: null,
          place: { archivedAt: null },
        }),
      }),
    )
  })
})
