/**
 * Barrel **client-safe** del módulo realtime. Importar desde client components
 * (`'use client'`), hooks y `features/*\/ui/`. NO incluye el sender ni el
 * provider — éstos viven en `./server`.
 */

export type {
  BroadcastHandler,
  BroadcastPayload,
  BroadcastSubscriber,
  BroadcastTopic,
  Unsubscribe,
} from './types'
export { SupabaseBroadcastSubscriber } from './supabase-subscriber'
export { FakeBroadcastSubscriber } from './fake-subscriber'
