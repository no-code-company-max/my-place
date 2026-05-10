import { type NextRequest } from 'next/server'
import { prisma } from '@/db/client'
import { clientEnv } from '@/shared/config/env'
import { createRequestLogger, REQUEST_ID_HEADER } from '@/shared/lib/request-id'
import { InvalidMagicLinkError, UserSyncError } from '@/shared/errors/auth'
import { createSupabaseServer } from '@/shared/lib/supabase/server'
import { cleanupLegacyCookies } from '@/shared/lib/supabase/cookie-cleanup'
import { resolveNextRedirect } from '@/shared/lib/next-redirect'
import { htmlRedirect } from '@/shared/lib/auth-redirect-html'
import { deriveDisplayName } from '@/app/auth/callback/helpers'

/**
 * GET /auth/invite-callback?token_hash=...&type=invite|magiclink&next=...
 *
 * Callback dedicado para magic links generados por `auth.admin.generateLink`.
 * Vive en APEX (no subdomain) — ver ADR `2026-05-10-auth-callbacks-on-apex.md`.
 *
 * Por qué existe (separado del `/auth/callback` PKCE flow): los `action_link`
 * que retorna `admin.generateLink` usan **implicit flow** — el verify de
 * Supabase redirige al `redirect_to` con tokens en `#hash` (fragment), que
 * no se envía al server. En este flow el email NO apunta al `action_link`
 * de Supabase; apunta acá con el `hashed_token` extraído del payload, y
 * nosotros llamamos `verifyOtp` server-side.
 *
 * **Por qué `htmlRedirect` y no `NextResponse.redirect`:** Safari iOS ITP
 * + algunos browsers descartan `Set-Cookie` headers en respuestas a redirects
 * HTTP (307/303). Documentado en supabase/ssr#36 y vercel/next.js
 * discussions/48434 — el síntoma es que el primer login solo deja
 * `sb-*-auth-token-code-verifier` sin la `auth-token` real. Workaround:
 * respuesta 200 OK con HTML meta-refresh (browser guarda cookies antes de
 * navegar).
 *
 * Steps:
 * 1. Validar `token_hash` no-vacío y `type` ∈ {invite, magiclink}.
 * 2. Cleanup defensivo de cookies legacy + `verifyOtp({ token_hash, type })`
 *    server-side via `createSupabaseServer()` (cookies via next/headers).
 * 3. Upsert `User` local (sync con `auth.users`).
 * 4. `htmlRedirect` al `next` resuelto via `resolveNextRedirect` (host-aware).
 *
 * Ver `docs/gotchas/supabase-magic-link-callback-required.md`.
 */
export async function GET(req: NextRequest) {
  const log = createRequestLogger(req.headers.get(REQUEST_ID_HEADER) ?? 'unknown')
  const url = new URL(req.url)
  const tokenHash = url.searchParams.get('token_hash')
  const rawType = url.searchParams.get('type')
  const rawNext = url.searchParams.get('next')

  if (!tokenHash) {
    log.warn(
      { err: new InvalidMagicLinkError('missing token_hash') },
      'invite_callback_missing_token',
    )
    return htmlRedirect(buildLoginUrl('invalid_link'))
  }

  const type = parseOtpType(rawType)
  if (!type) {
    log.warn(
      { err: new InvalidMagicLinkError('invalid type'), rawType },
      'invite_callback_invalid_type',
    )
    return htmlRedirect(buildLoginUrl('invalid_link'))
  }

  const redirectTarget = resolveNextRedirect(rawNext)
  const response = htmlRedirect(redirectTarget)
  cleanupLegacyCookies(req, response)

  const supabase = await createSupabaseServer()

  const { data: verify, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  })
  if (error || !verify.user || !verify.session) {
    log.warn(
      { err: new InvalidMagicLinkError(error?.message ?? 'no user/session'), type },
      'invite_callback_verify_failed',
    )
    return htmlRedirect(buildLoginUrl('invalid_link'))
  }

  // **Workaround para supabase/ssr#36 + discussions/35615:** verifyOtp setea
  // cookies vía onAuthStateChange listener async, que puede no ejecutarse
  // antes de que el response salga del handler. setSession() fuerza la
  // escritura síncrona de cookies vía cookieStore.set() de next/headers,
  // garantizando que el response incluya los Set-Cookie con la sesión nueva.
  await supabase.auth.setSession({
    access_token: verify.session.access_token,
    refresh_token: verify.session.refresh_token,
  })

  const { user } = verify
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
    log.error({ err: syncErr, userId: user.id }, 'invite_callback_user_sync_failed')
    await supabase.auth.signOut().catch(() => {})
    return htmlRedirect(buildLoginUrl('sync', new UserSyncError('user upsert failed')))
  }

  log.info({ userId: user.id, type }, 'invite_callback_success')
  return response
}

function parseOtpType(raw: string | null): 'invite' | 'magiclink' | null {
  if (raw === 'invite' || raw === 'magiclink') return raw
  return null
}

function buildLoginUrl(error: 'invalid_link' | 'sync', _cause?: Error): URL {
  return new URL(`/login?error=${error}`, clientEnv.NEXT_PUBLIC_APP_URL)
}

function fallbackEmail(userId: string): string {
  return `${userId}@noemail.place.local`
}
