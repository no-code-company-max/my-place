import type { BroadcastPayload, BroadcastSender, BroadcastTopic } from './types'

/**
 * Test double del `BroadcastSender`. Captura los envíos en memoria para
 * aserciones. Dos usos:
 *
 * 1. Unit tests de features (ej: `broadcastNewComment`) — inyectar vía
 *    `setBroadcastSender(new FakeBroadcastSender())` y leer `.captures`.
 * 2. Simular errores del transport (`failMode: true`) para verificar que
 *    los callers upstream tragan la excepción + no propagan.
 *
 * No es un mock — implementa la interfaz completa y retorna tipos correctos.
 */
export interface FakeSenderCapture {
  topic: BroadcastTopic
  event: string
  payload: BroadcastPayload
  sentAt: Date
}

export interface FakeBroadcastSenderOptions {
  /**
   * Si true, cada `send()` rechaza con Error simulando un fallo del transport.
   * Útil para verificar que los callers traguen la excepción (best-effort).
   */
  failMode?: boolean
}

export class FakeBroadcastSender implements BroadcastSender {
  readonly captures: FakeSenderCapture[] = []
  private failMode: boolean

  constructor(opts: FakeBroadcastSenderOptions = {}) {
    this.failMode = opts.failMode ?? false
  }

  async send<T extends BroadcastPayload>(
    topic: BroadcastTopic,
    event: string,
    payload: T,
  ): Promise<void> {
    if (this.failMode) {
      throw new Error('[FakeBroadcastSender] failMode: simulated transport failure')
    }
    this.captures.push({ topic, event, payload, sentAt: new Date() })
  }

  /** Último capture o null. Conveniente en aserciones. */
  get lastCapture(): FakeSenderCapture | null {
    return this.captures[this.captures.length - 1] ?? null
  }

  /** Limpia captures. Usar en `beforeEach`. */
  reset(): void {
    this.captures.length = 0
  }

  /** Activa/desactiva el modo falla mid-test. */
  setFailMode(value: boolean): void {
    this.failMode = value
  }
}
