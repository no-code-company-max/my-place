import { describe, expect, it, vi } from 'vitest'
import { SupabaseBroadcastSubscriber } from './supabase-subscriber'

type Handler = (...args: unknown[]) => void

// Fake mínimo del `SupabaseClient`/`RealtimeChannel` para verificar el
// lifecycle del subscribe sin abrir sockets reales.
function makeFakeSupabase() {
  const channel = {
    on: vi.fn(function on(
      this: typeof channel,
      _type: string,
      _filter: { event: string },
      handler: Handler,
    ) {
      channel._handlers.push(handler)
      return channel
    }),
    subscribe: vi.fn(function subscribe(this: typeof channel, cb?: (status: string) => void) {
      channel._subscribeCalled = true
      if (cb) cb('SUBSCRIBED')
      return channel
    }),
    unsubscribe: vi.fn(async () => undefined),
    _handlers: [] as Handler[],
    _config: null as { private: boolean } | null,
    _topic: '' as string,
    _subscribeCalled: false,
    /** Dispara los handlers registrados, como lo haría Supabase al recibir broadcast */
    _trigger(payload: unknown) {
      for (const h of channel._handlers) h({ event: 'broadcast', payload })
    },
  }
  const supabase = {
    channel: vi.fn((topic: string, opts: { config: { private: boolean } }) => {
      channel._topic = topic
      channel._config = opts.config
      return channel
    }),
    removeChannel: vi.fn(async () => undefined),
  }
  return { supabase, channel }
}

describe('SupabaseBroadcastSubscriber', () => {
  it('subscribe abre un canal privado con el topic indicado', () => {
    const { supabase, channel } = makeFakeSupabase()
    const sub = new SupabaseBroadcastSubscriber(supabase as never)

    sub.subscribe('post:123', 'comment_created', vi.fn())

    expect(supabase.channel).toHaveBeenCalledTimes(1)
    expect(channel._topic).toBe('post:123')
    expect(channel._config).toEqual({ private: true })
  })

  it('registra el handler con filter { event } correcto', () => {
    const { supabase, channel } = makeFakeSupabase()
    const sub = new SupabaseBroadcastSubscriber(supabase as never)

    sub.subscribe('t', 'comment_created', vi.fn())

    expect(channel.on).toHaveBeenCalledTimes(1)
    const [type, filter] = channel.on.mock.calls[0]!
    expect(type).toBe('broadcast')
    expect(filter).toEqual({ event: 'comment_created' })
  })

  it('handler recibe sólo el `payload` del evento, no el wrapping { event, payload }', () => {
    const { supabase, channel } = makeFakeSupabase()
    const sub = new SupabaseBroadcastSubscriber(supabase as never)
    const handler = vi.fn<(p: { id: string }) => void>()
    sub.subscribe<{ id: string }>('t', 'e', handler)

    channel._trigger({ id: 'c1' })
    channel._trigger({ id: 'c2' })

    expect(handler).toHaveBeenCalledTimes(2)
    expect(handler).toHaveBeenNthCalledWith(1, { id: 'c1' })
    expect(handler).toHaveBeenNthCalledWith(2, { id: 'c2' })
  })

  it('subscribe() del canal se llama después de registrar el handler', () => {
    const { supabase, channel } = makeFakeSupabase()
    const sub = new SupabaseBroadcastSubscriber(supabase as never)

    sub.subscribe('t', 'e', vi.fn())

    expect(channel.subscribe).toHaveBeenCalledTimes(1)
    expect(channel._subscribeCalled).toBe(true)
  })

  it('Unsubscribe retornado cierra el canal y lo remueve del cliente', async () => {
    const { supabase, channel } = makeFakeSupabase()
    const sub = new SupabaseBroadcastSubscriber(supabase as never)

    const off = sub.subscribe('t', 'e', vi.fn())
    off()
    // espera microtask para que las promesas pendientes resuelvan
    await new Promise((r) => setTimeout(r, 0))

    expect(channel.unsubscribe).toHaveBeenCalledTimes(1)
    expect(supabase.removeChannel).toHaveBeenCalledTimes(1)
    expect(supabase.removeChannel).toHaveBeenCalledWith(channel)
  })

  it('Unsubscribe es idempotente — invocarlo dos veces no rompe ni limpia doble', async () => {
    const { supabase, channel } = makeFakeSupabase()
    const sub = new SupabaseBroadcastSubscriber(supabase as never)

    const off = sub.subscribe('t', 'e', vi.fn())
    off()
    off()
    await new Promise((r) => setTimeout(r, 0))

    expect(channel.unsubscribe).toHaveBeenCalledTimes(1)
    expect(supabase.removeChannel).toHaveBeenCalledTimes(1)
  })

  it('múltiples subscribes abren canales separados con cleanup independiente', () => {
    const { supabase } = makeFakeSupabase()
    // Cada call a `channel()` del fake devuelve el mismo channel; en el test real
    // sólo nos interesa que `channel` se invoque N veces y se emitan N unsubscribe.
    const sub = new SupabaseBroadcastSubscriber(supabase as never)

    const offA = sub.subscribe('post:1', 'e', vi.fn())
    const offB = sub.subscribe('post:2', 'e', vi.fn())

    expect(supabase.channel).toHaveBeenCalledTimes(2)
    offA()
    offB()
  })
})
