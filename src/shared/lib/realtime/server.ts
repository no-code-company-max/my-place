import 'server-only'

/**
 * Barrel **server-only** del módulo realtime. Importar desde server components,
 * server actions o código `src/features/*\/server/`. Un import accidental desde
 * un client component falla el build (el `'server-only'` de los módulos internos
 * levanta error en el bundler).
 *
 * Simetría con el `client.ts` — dos entry points separados para que el bundler
 * nunca arrastre el sender al bundle cliente.
 */

export type {
  BroadcastHandler,
  BroadcastPayload,
  BroadcastSender,
  BroadcastSubscriber,
  BroadcastTopic,
  Unsubscribe,
} from './types'
export {
  getBroadcastSender,
  isBroadcastSenderOverridden,
  resetBroadcastSender,
  setBroadcastSender,
} from './sender-provider'
export { SupabaseBroadcastSender } from './supabase-sender'
export { FakeBroadcastSender } from './fake-sender'
export type { FakeSenderCapture, FakeBroadcastSenderOptions } from './fake-sender'
