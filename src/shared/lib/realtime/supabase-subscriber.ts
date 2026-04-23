import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import type {
  BroadcastHandler,
  BroadcastPayload,
  BroadcastSubscriber,
  BroadcastTopic,
  Unsubscribe,
} from './types'

/**
 * Impl client-side del `BroadcastSubscriber` sobre Supabase Realtime.
 *
 * Cada `subscribe()` abre un canal privado (`{ config: { private: true } }`) —
 * las policies `realtime.messages` enforcan membership antes de entregar el
 * mensaje. `private: true` es obligatorio: con él, incluso si el cliente
 * conoce el topic, Supabase rechaza si no es miembro.
 *
 * Shape del evento broadcast de Supabase: `{ event: string, payload: T }`.
 * Acá desempaquetamos y pasamos sólo `payload` al handler — el event ya
 * está discriminado por el filter en el `.on()`.
 *
 * Lifecycle: `subscribe()` registra handler → llama `channel.subscribe()`
 * (abre WS). `Unsubscribe()` cierra canal y lo remueve del cliente. Es
 * idempotente — invocarlo dos veces no duplica el cleanup.
 *
 * El cliente Supabase se inyecta (no se crea acá) para mantener el shared
 * desacoplado del path del browser factory.
 */
export class SupabaseBroadcastSubscriber implements BroadcastSubscriber {
  constructor(private readonly supabase: SupabaseClient) {}

  subscribe<T extends BroadcastPayload>(
    topic: BroadcastTopic,
    event: string,
    handler: BroadcastHandler<T>,
  ): Unsubscribe {
    const channel: RealtimeChannel = this.supabase.channel(topic, {
      config: { private: true },
    })

    channel.on('broadcast', { event }, (message: { event: string; payload: T }) => {
      handler(message.payload)
    })
    channel.subscribe()

    let cleaned = false
    return () => {
      if (cleaned) return
      cleaned = true
      void channel.unsubscribe()
      void this.supabase.removeChannel(channel)
    }
  }
}
