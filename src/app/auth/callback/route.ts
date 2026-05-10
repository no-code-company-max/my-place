import { type NextRequest } from 'next/server'
import { prisma } from '@/db/client'
import { clientEnv } from '@/shared/config/env'
import { createRequestLogger, REQUEST_ID_HEADER } from '@/shared/lib/request-id'
import { InvalidMagicLinkError, UserSyncError } from '@/shared/errors/auth'
import { createSupabaseServer } from '@/shared/lib/supabase/server'
import { cleanupLegacyCookies } from '@/shared/lib/supabase/cookie-cleanup'
import { resolveNextRedirect } from '@/shared/lib/next-redirect'
import { htmlRedirect } from '@/shared/lib/auth-redirect-html'
import { deriveDisplayName } from './helpers'

/**
 * GET /auth/callback?code=...&next=...
 *
 * Callback PKCE para magic links generados por `signInWithOtp` desde el
 * browser. Vive en APEX — ver ADR `2026-05-10-auth-callbacks-on-apex.md`.
 *
 * Si el flow viene de `auth.admin.generateLink` (server-side, implicit
 * flow), usar `/auth/invite-callback` en su lugar.
 *
 * **Por qué `htmlRedirect` y no `NextResponse.redirect`:** Safari iOS ITP
 * + algunos browsers descartan `Set-Cookie` headers en respuestas a
 * redirects HTTP (307/303). Documentado en supabase/ssr#36 y vercel/next.js
 * discussions/48434. Workaround: respuesta 200 OK con HTML meta-refresh
 * (browser guarda cookies antes de navegar).
 *
 * Steps:
 * 1. Validar `code` no-vacío.
 * 2. Cleanup defensivo de cookies legacy.
 * 3. `exchangeCodeForSession(code)` server-side via `createSupabaseServer()`.
 * 4. Upsert `User` local.
 * 5. `htmlRedirect` al `next` resuelto via `resolveNextRedirect` (host-aware).
 *
 * Ver `docs/features/auth/spec.md`.
 */
export async function GET(req: NextRequest) {
  const log = createRequestLogger(req.headers.get(REQUEST_ID_HEADER) ?? 'unknown')
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const rawNext = url.searchParams.get('next')

  if (!code) {
    log.warn({ err: new InvalidMagicLinkError('missing code') }, 'callback_missing_code')
    return htmlRedirect(buildLoginUrl('invalid_link'))
  }

  const redirectTarget = resolveNextRedirect(rawNext)
  const response = htmlRedirect(redirectTarget)
  cleanupLegacyCookies(req, response)

  const supabase = await createSupabaseServer()

  const { data: exchange, error } = await supabase.auth.exchangeCodeForSession(code)
  if (error || !exchange.user || !exchange.session) {
    log.warn(
      { err: new InvalidMagicLinkError(error?.message ?? 'no user/session') },
      'callback_exchange_failed',
    )
    return htmlRedirect(buildLoginUrl('invalid_link'))
  }

  // Workaround supabase/ssr#36 — fuerza escritura síncrona de cookies.
  await supabase.auth.setSession({
    access_token: exchange.session.access_token,
    refresh_token: exchange.session.refresh_token,
  })

  const { user } = exchange
  try {
    const email = user.email ?? null
    await prisma.user.upsert({
      where: { id: user.id },
      create: {
        id: user.id,
        email: email ?? fallbackEmail(user.id),
        displayName: deriveDisplayName(email, user.user_metadata),
      },
      update: email ? { email } : {},
    })
  } catch (syncErr) {
    log.error({ err: syncErr, userId: user.id }, 'user_sync_failed')
    await supabase.auth.signOut().catch(() => {})
    return htmlRedirect(buildLoginUrl('sync', new UserSyncError('user upsert failed')))
  }

  log.info({ userId: user.id }, 'callback_success')
  return response
}

function buildLoginUrl(error: 'invalid_link' | 'sync', _cause?: Error): URL {
  return new URL(`/login?error=${error}`, clientEnv.NEXT_PUBLIC_APP_URL)
}

function fallbackEmail(userId: string): string {
  return `${userId}@noemail.place.local`
}
