import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/db/client'
import { clientEnv } from '@/shared/config/env'
import { createRequestLogger, REQUEST_ID_HEADER } from '@/shared/lib/request-id'
import { InvalidMagicLinkError, UserSyncError } from '@/shared/errors/auth'
import { createSupabaseServer } from '@/shared/lib/supabase/server'
import { cleanupLegacyCookies } from '@/shared/lib/supabase/cookie-cleanup'
import { resolveNextRedirect } from '@/shared/lib/next-redirect'
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
 * Steps:
 * 1. Validar `code` no-vacío.
 * 2. Cleanup defensivo de cookies legacy.
 * 3. `exchangeCodeForSession(code)` server-side via `createSupabaseServer()`
 *    (cookies via next/headers; setea con `Domain=<apex>` para cruzar
 *    subdomains).
 * 4. Upsert `User` local.
 * 5. Redirige a `next` resuelto via `resolveNextRedirect` (host-aware).
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
    return redirectToPath('/login?error=invalid_link')
  }

  const redirectTarget = resolveNextRedirect(rawNext)
  let response = NextResponse.redirect(redirectTarget)
  cleanupLegacyCookies(req, response)

  const supabase = await createSupabaseServer()

  const { data: exchange, error } = await supabase.auth.exchangeCodeForSession(code)
  if (error || !exchange.user) {
    log.warn(
      { err: new InvalidMagicLinkError(error?.message ?? 'no user') },
      'callback_exchange_failed',
    )
    return redirectToPath('/login?error=invalid_link')
  }

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
    response = redirectToPath('/login?error=sync', new UserSyncError('user upsert failed'))
    return response
  }

  log.info({ userId: user.id }, 'callback_success')
  return response
}

function redirectToPath(path: string, _cause?: Error) {
  const url = new URL(path, clientEnv.NEXT_PUBLIC_APP_URL)
  return NextResponse.redirect(url)
}

function fallbackEmail(userId: string): string {
  return `${userId}@noemail.place.local`
}
