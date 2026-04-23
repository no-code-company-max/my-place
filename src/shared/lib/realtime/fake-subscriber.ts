import type {
  BroadcastHandler,
  BroadcastPayload,
  BroadcastSubscriber,
  BroadcastTopic,
  Unsubscribe,
} from './types'

/**
 * Test double del `BroadcastSubscriber`. Los tests gatillan mensajes con `.emit(
 * topic, event, payload)`; los handlers suscritos reciben el payload como si
 * hubiera llegado por WS.
 *
 * No abre socket — es puro en memoria. Usado en tests de hooks client-side
 * (`useCommentRealtime`) y en componentes que consumen `BroadcastSubscriber`.
 */
export class FakeBroadcastSubscriber implements BroadcastSubscriber {
  private handlers = new Map<string, Array<BroadcastHandler<BroadcastPayload>>>()

  subscribe<T extends BroadcastPayload>(
    topic: BroadcastTopic,
    event: string,
    handler: BroadcastHandler<T>,
  ): Unsubscribe {
    const key = channelKey(topic, event)
    const list = this.handlers.get(key) ?? []
    list.push(handler as BroadcastHandler<BroadcastPayload>)
    this.handlers.set(key, list)
    return () => {
      const current = this.handlers.get(key)
      if (!current) return
      const idx = current.indexOf(handler as BroadcastHandler<BroadcastPayload>)
      if (idx === -1) return
      current.splice(idx, 1)
      if (current.length === 0) this.handlers.delete(key)
    }
  }

  /** Dispara a todos los handlers registrados en `(topic, event)`. No-op si no hay. */
  emit<T extends BroadcastPayload>(topic: BroadcastTopic, event: string, payload: T): void {
    const list = this.handlers.get(channelKey(topic, event))
    if (!list) return
    // Copia defensiva: un handler podría llamar a su propio unsubscribe durante
    // su ejecución. Mutar el array activo invalidaría el índice del forEach.
    for (const handler of [...list]) handler(payload)
  }

  /** Remueve todos los handlers. Usar en `afterEach`. */
  reset(): void {
    this.handlers.clear()
  }
}

function channelKey(topic: BroadcastTopic, event: string): string {
  return `${topic}::${event}`
}
