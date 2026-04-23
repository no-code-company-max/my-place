import 'server-only'
import type { BroadcastSender } from './types'
import { SupabaseBroadcastSender } from './supabase-sender'

/**
 * Factory singleton del `BroadcastSender`. Mismo patrón que `shared/lib/mailer/
 * provider.ts` — default construido lazy, override en tests, reset explícito.
 *
 * Sólo sender vive en server: el subscriber es client-side y se instancia
 * directo en el hook (ver `shared/lib/realtime/supabase-subscriber.ts`).
 */

let _sender: BroadcastSender | null = null
let _overridden = false

export function getBroadcastSender(): BroadcastSender {
  if (_sender) return _sender
  _sender = new SupabaseBroadcastSender()
  return _sender
}

/** Inyección para tests. Persiste hasta `resetBroadcastSender()`. */
export function setBroadcastSender(sender: BroadcastSender): void {
  _sender = sender
  _overridden = true
}

/** Restaura el default. Usar en `afterEach`. */
export function resetBroadcastSender(): void {
  _sender = null
  _overridden = false
}

/** Introspección para tests. */
export function isBroadcastSenderOverridden(): boolean {
  return _overridden
}
