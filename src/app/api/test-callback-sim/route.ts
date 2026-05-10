import { type NextRequest } from 'next/server'
import { clientEnv } from '@/shared/config/env'
import { cookieDomain } from '@/shared/lib/supabase/cookie-domain'
import {
  applyCookies,
  buildLegacyCookieCleanup,
  type CookieToSet,
} from '@/shared/lib/supabase/cookie-cleanup'
import { buildSessionCookies, extractProjectRef } from '@/shared/lib/supabase/build-session-cookies'
import { htmlRedirect } from '@/shared/lib/auth-redirect-html'

/**
 * DEBUG TEMPORAL — Simula EXACTAMENTE el callback success con cookies fake.
 * Permite testear todo el flow (htmlRedirect + buildSessionCookies + applyCookies)
 * SIN depender de un magic link válido.
 *
 * Flow:
 * 1. Construye legacy cookie cleanup (igual que callback real)
 * 2. Construye session cookies con tokens fake (igual que callback success)
 * 3. Retorna htmlRedirect a /api/debug-cookies (para inspección post-flow)
 *
 * User flow: abrir esta URL en mobile → ver "Redirigiendo..." → llega a
 * /api/debug-cookies → JSON debe mostrar `sb-<projectRef>-auth-token` con
 * value > 0 (la cookie test del simulador).
 */
export function GET(req: NextRequest) {
  const cookieBag: CookieToSet[] = []
  cookieBag.push(...buildLegacyCookieCleanup(req))

  const domain = cookieDomain(clientEnv.NEXT_PUBLIC_APP_DOMAIN)
  const projectRef = extractProjectRef(clientEnv.NEXT_PUBLIC_SUPABASE_URL)

  // Session fake — formato igual que verifyOtp/exchangeCodeForSession real.
  const fakeSession = {
    access_token: 'eyFakeAccessTokenFor' + 'X'.repeat(800), // ~820 chars (similar a JWT real)
    refresh_token: 'fake-refresh-token-' + 'Y'.repeat(40),
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    expires_in: 3600,
    token_type: 'bearer',
  }
  const fakeUser = {
    id: '00000000-0000-0000-0000-000000000000',
    email: 'test@simulated.example',
    user_metadata: {},
    app_metadata: {},
  }

  cookieBag.push(
    ...buildSessionCookies({
      session: fakeSession,
      user: fakeUser,
      projectRef,
      domain,
    }),
  )

  const target = new URL('/api/debug-cookies', req.url)
  const response = htmlRedirect(target)
  applyCookies(response, cookieBag)

  // Debug headers
  response.headers.set('x-debug-bag-size', String(cookieBag.length))
  response.headers.set(
    'x-debug-bag-names',
    cookieBag.map((c) => `${c.name}|d=${c.options.domain ?? '-'}|v=${c.value.length}`).join(','),
  )
  return response
}
