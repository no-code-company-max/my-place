import { beforeEach, describe, expect, it, vi } from 'vitest'

const { runErasureMock, getEnv, loggerError } = vi.hoisted(() => ({
  runErasureMock: vi.fn(),
  getEnv: vi.fn<() => { CRON_SECRET: string | undefined }>(),
  loggerError: vi.fn(),
}))

vi.mock('server-only', () => ({}))

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
  logger: { error: loggerError, info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

vi.mock('@/features/members/server/erasure/run-erasure', () => ({
  runErasure: runErasureMock,
}))

import { GET } from '../route'

const VALID_SECRET = 'a'.repeat(32)

function mkReq(headers: Record<string, string> = {}, search = ''): Request {
  return new Request(`http://localhost/api/cron/erasure${search}`, {
    method: 'GET',
    headers: { ...headers },
  })
}

beforeEach(() => {
  runErasureMock.mockReset()
  getEnv.mockReset()
  loggerError.mockReset()
  getEnv.mockReturnValue({ CRON_SECRET: VALID_SECRET })
  runErasureMock.mockResolvedValue({
    dryRun: false,
    membershipsProcessed: 0,
    postsAnonymized: 0,
    commentsAnonymized: 0,
    errorsPerMembership: [],
  })
})

describe('GET /api/cron/erasure', () => {
  it('401 si falta el header Authorization', async () => {
    const res = await GET(mkReq() as never)
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'unauthorized' })
    expect(runErasureMock).not.toHaveBeenCalled()
  })

  it('401 si el header tiene secret incorrecto', async () => {
    const res = await GET(mkReq({ authorization: `Bearer ${'b'.repeat(32)}` }) as never)
    expect(res.status).toBe(401)
    expect(runErasureMock).not.toHaveBeenCalled()
  })

  it('401 si CRON_SECRET no está configurado en env', async () => {
    getEnv.mockReturnValue({ CRON_SECRET: undefined })
    const res = await GET(mkReq({ authorization: `Bearer ${VALID_SECRET}` }) as never)
    expect(res.status).toBe(401)
    expect(runErasureMock).not.toHaveBeenCalled()
  })

  it('200 con secret correcto: invoca runErasure con dryRun=false por default', async () => {
    runErasureMock.mockResolvedValue({
      dryRun: false,
      membershipsProcessed: 3,
      postsAnonymized: 7,
      commentsAnonymized: 12,
      errorsPerMembership: [],
    })
    const res = await GET(mkReq({ authorization: `Bearer ${VALID_SECRET}` }) as never)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      ok: true,
      dryRun: false,
      membershipsProcessed: 3,
      postsAnonymized: 7,
      commentsAnonymized: 12,
      errorsPerMembership: [],
    })
    expect(runErasureMock).toHaveBeenCalledWith({ dryRun: false })
  })

  it('200 con ?dryRun=true: invoca runErasure con dryRun=true', async () => {
    runErasureMock.mockResolvedValue({
      dryRun: true,
      membershipsProcessed: 2,
      postsAnonymized: 4,
      commentsAnonymized: 5,
      errorsPerMembership: [],
    })
    const res = await GET(
      mkReq({ authorization: `Bearer ${VALID_SECRET}` }, '?dryRun=true') as never,
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.dryRun).toBe(true)
    expect(runErasureMock).toHaveBeenCalledWith({ dryRun: true })
  })

  it('500 si runErasure throws: loguea error + response 500', async () => {
    runErasureMock.mockRejectedValue(new Error('prisma connection lost'))
    const res = await GET(mkReq({ authorization: `Bearer ${VALID_SECRET}` }) as never)

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ ok: false })
    expect(loggerError).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'cronErasureFailed' }),
      expect.any(String),
    )
  })

  it('comparación timing-safe: headers de distinta longitud dan 401 sin throw', async () => {
    const res = await GET(mkReq({ authorization: 'Bearer short' }) as never)
    expect(res.status).toBe(401)
  })
})
