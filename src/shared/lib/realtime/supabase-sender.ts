import 'server-only'
import { clientEnv } from '@/shared/config/env'
import { logger } from '@/shared/lib/logger'
import { createSupabaseServer } from '@/shared/lib/supabase/server'
import type { BroadcastPayload, BroadcastSender, BroadcastTopic } from './types'

/**
 * Implementación productiva de `BroadcastSender` sobre Supabase Realtime.
 *
 * Transporte: **HTTP broadcast endpoint** (`POST /realtime/v1/api/broadcast`)
 * con el JWT del actor — una sola request one-shot, sin handshake WS ni
 * subscribe/unsubscribe. Supabase enforca RLS (`discussions_thread_send`)
 * igual que en WS.
 *
 * Postura best-effort: errores (sin sesión, HTTP non-2xx, network, getSession
 * reject) se logean con `pino.warn({ event: 'broadcastSend...', ... })` y se
 * tragan. El caller (ej: `broadcastNewComment`) nunca depende del éxito —
 * la fuente autoritaria de visibilidad es `revalidatePath`.
 *
 * Rationale de HTTP sobre WS (ver ADR `2026-04-21-shared-realtime-module.md`):
 * emisión one-shot desde server action ≈ 50ms; WS channel.send requiere
 * handshake + SUBSCRIBED + send + unsubscribe ≈ 200ms+ por action. Mal fit.
 */
export class SupabaseBroadcastSender implements BroadcastSender {
  async send<T extends BroadcastPayload>(
    topic: BroadcastTopic,
    event: string,
    payload: T,
  ): Promise<void> {
    const accessToken = await this.resolveAccessToken(topic, event)
    if (!accessToken) return
    await this.postBroadcast(topic, event, payload, accessToken)
  }

  private async resolveAccessToken(topic: BroadcastTopic, event: string): Promise<string | null> {
    try {
      const supabase = await createSupabaseServer()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) {
        logger.warn(
          { event: 'broadcastSendSkipped', reason: 'no_session', topic, broadcastEvent: event },
          'broadcast skipped: no session',
        )
        return null
      }
      return session.access_token
    } catch (err) {
      logger.warn(
        {
          event: 'broadcastSendSkipped',
          reason: 'session_error',
          topic,
          broadcastEvent: event,
          err: err instanceof Error ? { message: err.message, name: err.name } : err,
        },
        'broadcast skipped: session resolution failed',
      )
      return null
    }
  }

  private async postBroadcast<T extends BroadcastPayload>(
    topic: BroadcastTopic,
    event: string,
    payload: T,
    accessToken: string,
  ): Promise<void> {
    const url = `${clientEnv.NEXT_PUBLIC_SUPABASE_URL}/realtime/v1/api/broadcast`
    const body = JSON.stringify({
      messages: [{ topic, event, payload, private: true }],
    })
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          apikey: clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        },
        body,
      })
      if (!response.ok) {
        logger.warn(
          {
            event: 'broadcastSendFailed',
            reason: 'http_error',
            status: response.status,
            topic,
            broadcastEvent: event,
          },
          'broadcast failed: non-2xx response',
        )
      }
    } catch (err) {
      logger.warn(
        {
          event: 'broadcastSendFailed',
          reason: 'fetch_error',
          topic,
          broadcastEvent: event,
          err: err instanceof Error ? { message: err.message, name: err.name } : err,
        },
        'broadcast failed: fetch rejected',
      )
    }
  }
}
