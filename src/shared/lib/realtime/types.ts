/**
 * Primitivos de broadcast en tiempo real, agnósticos de dominio.
 *
 * `shared/lib/realtime` expone sólo transport. Las features (`discussions`, futuros
 * `dms`, `chat`, `events`) construyen su convención de `topic` — acá el topic es
 * `string` opaco y los payloads son JSON-serializables.
 *
 * Separación server/cliente: el sender vive sólo en server (cookies del actor
 * → JWT → emisión REST). El subscriber vive sólo en cliente (long-lived WS).
 * Los barrels `server.ts` y `client.ts` garantizan que el bundler no arrastre
 * código server al bundle cliente.
 *
 * Postura de entrega: **best-effort**. Los errores se logean y se tragan; el
 * caller nunca depende del éxito del broadcast para consistencia — la
 * revalidación SSR por `revalidatePath` es la fuente autoritaria.
 */

export type BroadcastTopic = string

export type BroadcastPayload = Record<string, unknown>

export interface BroadcastSender {
  /**
   * Emite un evento sobre el `topic`. Best-effort: no hace retry, los errores
   * se logean + se tragan. El caller NO debe depender del éxito para
   * consistencia — usar `revalidatePath` como fuente autoritaria.
   */
  send<T extends BroadcastPayload>(topic: BroadcastTopic, event: string, payload: T): Promise<void>
}

export type Unsubscribe = () => void

export type BroadcastHandler<T extends BroadcastPayload> = (payload: T) => void

export interface BroadcastSubscriber {
  /**
   * Registra un handler para `(topic, event)`. Retorna `Unsubscribe` que cierra
   * el canal y remueve listeners. Llamar al retorno es obligatorio al unmount.
   */
  subscribe<T extends BroadcastPayload>(
    topic: BroadcastTopic,
    event: string,
    handler: BroadcastHandler<T>,
  ): Unsubscribe
}
