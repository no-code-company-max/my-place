import { beforeEach, describe, expect, it, vi } from 'vitest'

const { constructEventMock, loggerInfo, loggerWarn, loggerError, getEnv } = vi.hoisted(() => ({
  constructEventMock: vi.fn(),
  loggerInfo: vi.fn(),
  loggerWarn: vi.fn(),
  loggerError: vi.fn(),
  // Getter dinámico para controlar presencia/ausencia de secrets por test
  // — simula `serverEnv.STRIPE_*` sin disparar el Proxy real.
  getEnv:
    vi.fn<
      () => { STRIPE_SECRET_KEY: string | undefined; STRIPE_WEBHOOK_SECRET: string | undefined }
    >(),
}))

vi.mock('server-only', () => ({}))

vi.mock('@/shared/config/env', () => ({
  serverEnv: new Proxy(
    {},
    {
      get(_target, key) {
        const env = getEnv()
        if (key === 'STRIPE_SECRET_KEY') return env.STRIPE_SECRET_KEY
        if (key === 'STRIPE_WEBHOOK_SECRET') return env.STRIPE_WEBHOOK_SECRET
        return undefined
      },
    },
  ),
}))

vi.mock('@/shared/lib/logger', () => ({
  logger: { info: loggerInfo, warn: loggerWarn, error: loggerError, debug: vi.fn() },
}))

vi.mock('@/shared/lib/stripe', () => ({
  getStripe: () => ({
    webhooks: { constructEvent: constructEventMock },
  }),
}))

import { POST } from '../route'

function mkReq(body: string, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/webhooks/stripe', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body,
  })
}

beforeEach(() => {
  constructEventMock.mockReset()
  loggerInfo.mockReset()
  loggerWarn.mockReset()
  loggerError.mockReset()
  getEnv.mockReturnValue({
    STRIPE_SECRET_KEY: 'sk_test_dummy',
    STRIPE_WEBHOOK_SECRET: 'whsec_dummy',
  })
})

describe('POST /api/webhooks/stripe', () => {
  it('400 si falta el header `stripe-signature`', async () => {
    const res = await POST(mkReq('{}') as never)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body).toEqual({ error: 'missing stripe-signature' })
    expect(constructEventMock).not.toHaveBeenCalled()
  })

  it('200 pre-billing cuando STRIPE_WEBHOOK_SECRET falta (Fase 3 pendiente)', async () => {
    getEnv.mockReturnValue({ STRIPE_SECRET_KEY: undefined, STRIPE_WEBHOOK_SECRET: undefined })

    const res = await POST(mkReq('{}', { 'stripe-signature': 't=1,v1=fake' }) as never)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ received: true, phase: 'pre-billing' })
    expect(constructEventMock).not.toHaveBeenCalled()
    expect(loggerWarn).toHaveBeenCalled()
  })

  it('200 pre-billing también si sólo falta STRIPE_WEBHOOK_SECRET', async () => {
    getEnv.mockReturnValue({ STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: undefined })

    const res = await POST(mkReq('{}', { 'stripe-signature': 't=1,v1=fake' }) as never)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ phase: 'pre-billing' })
  })

  it('400 si la firma es inválida (Stripe.constructEvent lanza)', async () => {
    constructEventMock.mockImplementation(() => {
      throw new Error('No signatures found matching the expected signature for payload')
    })

    const res = await POST(
      mkReq('{"type":"customer.subscription.created"}', {
        'stripe-signature': 't=1,v1=bad',
      }) as never,
    )
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid signature' })
    expect(loggerError).toHaveBeenCalled()
  })

  it('200 con firma válida y body parseable: loguea type + id del event', async () => {
    constructEventMock.mockReturnValue({
      id: 'evt_test_123',
      type: 'customer.subscription.created',
      data: { object: {} },
    })

    const payload = JSON.stringify({ dummy: true })
    const res = await POST(mkReq(payload, { 'stripe-signature': 't=1,v1=good' }) as never)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ received: true })
    expect(constructEventMock).toHaveBeenCalledWith(payload, 't=1,v1=good', 'whsec_dummy')

    const logCall = loggerInfo.mock.calls.find((args) => {
      const arg0 = args[0] as { type?: string; id?: string } | undefined
      return arg0?.type === 'customer.subscription.created' && arg0?.id === 'evt_test_123'
    })
    expect(logCall).toBeDefined()
  })

  it('200 también para event types desconocidos (despacho futuro en Fase 3)', async () => {
    constructEventMock.mockReturnValue({
      id: 'evt_unknown',
      type: 'some.unknown.event',
      data: { object: {} },
    })

    const res = await POST(mkReq('{}', { 'stripe-signature': 't=1,v1=good' }) as never)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ received: true })
  })
})
