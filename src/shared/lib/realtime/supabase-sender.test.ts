import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// `vi.mock` se hoistea sobre los imports; para compartir refs con los tests
// usamos `vi.hoisted`, que corre antes de cualquier mock.
const { getSessionMock, loggerWarn, loggerDebug } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  loggerWarn: vi.fn(),
  loggerDebug: vi.fn(),
}))

vi.mock('@/shared/lib/supabase/server', () => ({
  createSupabaseServer: vi.fn(async () => ({
    auth: { getSession: getSessionMock },
  })),
}))

vi.mock('@/shared/config/env', () => ({
  clientEnv: {
    NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key-123',
  },
}))

vi.mock('@/shared/lib/logger', () => ({
  logger: { warn: loggerWarn, debug: loggerDebug, info: vi.fn(), error: vi.fn() },
}))

import { SupabaseBroadcastSender } from './supabase-sender'

describe('SupabaseBroadcastSender', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response('{}', { status: 202, headers: { 'content-type': 'application/json' } }),
      )
    getSessionMock.mockReset()
    loggerWarn.mockReset()
    loggerDebug.mockReset()
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  it('POST contra /realtime/v1/api/broadcast con header Authorization del access_token', async () => {
    getSessionMock.mockResolvedValue({
      data: { session: { access_token: 'user-jwt-abc' } },
      error: null,
    })
    const sender = new SupabaseBroadcastSender()

    await sender.send('post:123', 'comment_created', { comment: { id: 'c1' } })

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0]!
    expect(url).toBe('https://project.supabase.co/realtime/v1/api/broadcast')
    const headers = (init as RequestInit).headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer user-jwt-abc')
    expect(headers.apikey).toBe('anon-key-123')
    expect(headers['Content-Type']).toBe('application/json')
    expect((init as RequestInit).method).toBe('POST')
  })

  it('body: { messages: [{ topic, event, payload, private: true }] }', async () => {
    getSessionMock.mockResolvedValue({
      data: { session: { access_token: 'jwt' } },
      error: null,
    })
    const sender = new SupabaseBroadcastSender()

    await sender.send('post:abc', 'comment_created', { hello: 'world' })

    const [, init] = fetchSpy.mock.calls[0]!
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body).toEqual({
      messages: [
        {
          topic: 'post:abc',
          event: 'comment_created',
          payload: { hello: 'world' },
          private: true,
        },
      ],
    })
  })

  it('sin sesión: log warn + no hace fetch (best-effort, no throw)', async () => {
    getSessionMock.mockResolvedValue({ data: { session: null }, error: null })
    const sender = new SupabaseBroadcastSender()

    await expect(sender.send('post:1', 'e', {})).resolves.toBeUndefined()

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(loggerWarn).toHaveBeenCalled()
    const logCall = loggerWarn.mock.calls[0]![0]
    expect(logCall).toMatchObject({ event: 'broadcastSendSkipped' })
  })

  it('HTTP 4xx/5xx: log warn + no throw (best-effort)', async () => {
    getSessionMock.mockResolvedValue({
      data: { session: { access_token: 'jwt' } },
      error: null,
    })
    fetchSpy.mockResolvedValue(new Response('{"error":"forbidden"}', { status: 403 }))
    const sender = new SupabaseBroadcastSender()

    await expect(sender.send('post:1', 'e', {})).resolves.toBeUndefined()

    expect(loggerWarn).toHaveBeenCalled()
    const logCall = loggerWarn.mock.calls[0]![0]
    expect(logCall).toMatchObject({
      event: 'broadcastSendFailed',
      status: 403,
    })
  })

  it('fetch throws (network): log warn + swallow', async () => {
    getSessionMock.mockResolvedValue({
      data: { session: { access_token: 'jwt' } },
      error: null,
    })
    fetchSpy.mockRejectedValue(new Error('ECONNRESET'))
    const sender = new SupabaseBroadcastSender()

    await expect(sender.send('post:1', 'e', {})).resolves.toBeUndefined()

    expect(loggerWarn).toHaveBeenCalled()
    const logCall = loggerWarn.mock.calls[0]![0]
    expect(logCall).toMatchObject({ event: 'broadcastSendFailed' })
  })

  it('getSession throws: log warn + swallow (no propaga al caller)', async () => {
    getSessionMock.mockRejectedValue(new Error('cookie parse error'))
    const sender = new SupabaseBroadcastSender()

    await expect(sender.send('post:1', 'e', {})).resolves.toBeUndefined()

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(loggerWarn).toHaveBeenCalled()
  })

  it('éxito 2xx: no warn, sí debug opcional para observabilidad', async () => {
    getSessionMock.mockResolvedValue({
      data: { session: { access_token: 'jwt' } },
      error: null,
    })
    const sender = new SupabaseBroadcastSender()

    await sender.send('post:1', 'comment_created', { id: 'x' })

    expect(loggerWarn).not.toHaveBeenCalled()
  })
})
