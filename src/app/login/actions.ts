'use server'

import { headers } from 'next/headers'
import { z } from 'zod'
import { createSupabaseServer } from '@/shared/lib/supabase/server'
import { createRequestLogger, REQUEST_ID_HEADER } from '@/shared/lib/request-id'
import { clientEnv } from '@/shared/config/env'
import { MagicLinkRateLimitedError } from '@/shared/errors/auth'

const schema = z.object({
  email: z.string().email(),
  next: z.string().optional(),
})

export type RequestMagicLinkResult =
  | { ok: true }
  | { ok: false; error: 'validation' | 'unexpected' }

/**
 * Inicia el flujo de magic link.
 * Siempre retorna `{ ok: true }` salvo validación de formato —
 * no se filtra si el email existe ni si Supabase throttleó el envío.
 */
export async function requestMagicLink(input: unknown): Promise<RequestMagicLinkResult> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: 'validation' }
  }

  const { email, next } = parsed.data
  const headerStore = await headers()
  const log = createRequestLogger(headerStore.get(REQUEST_ID_HEADER) ?? 'unknown')

  const redirectTo = new URL('/auth/callback', clientEnv.NEXT_PUBLIC_APP_URL)
  if (next) redirectTo.searchParams.set('next', next)

  const supabase = await createSupabaseServer()

  // DEBUG TEMPORAL 2026-05-10: log entry con email completo + redirectTo para
  // confirmar request shape.
  log.warn(
    {
      debug: 'request_magic_link_entry',
      email,
      redirectTo: redirectTo.toString(),
    },
    'DEBUG requestMagicLink entry',
  )

  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo.toString() },
  })

  // DEBUG TEMPORAL: log raw del resultado de signInWithOtp.
  log.warn(
    {
      debug: 'request_magic_link_result',
      hasError: !!error,
      errorStatus: error?.status ?? null,
      errorCode: error?.code ?? null,
      errorMessage: error?.message ?? null,
      errorName: error?.name ?? null,
      hasData: !!data,
      dataUser: data?.user ?? null,
      dataSession: data?.session ?? null,
    },
    'DEBUG requestMagicLink result',
  )

  if (error) {
    const rateLimited =
      error.status === 429 ||
      /rate.?limit/i.test(error.message ?? '') ||
      error.code === 'over_email_send_rate_limit'

    if (rateLimited) {
      log.warn({ err: new MagicLinkRateLimitedError(error.message) }, 'magic_link_rate_limited')
    } else {
      log.error({ err: error, emailDomain: email.split('@')[1] }, 'magic_link_failed')
    }
    // Política: nunca filtrar detalles al cliente.
    return { ok: true }
  }

  log.info({ emailDomain: email.split('@')[1] }, 'magic_link_sent')
  return { ok: true }
}
