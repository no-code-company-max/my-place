import 'server-only'
import type { NextRequest, NextResponse } from 'next/server'
import { clientEnv } from '@/shared/config/env'

/**
 * Defensive cleanup de cookies de sesión Supabase con domains "legacy"
 * (i.e. distintos al `Domain=<apex>` que setteamos hoy).
 *
 * **Por qué:** users que tienen sesiones residuales de versiones previas
 * del producto pueden tener cookies `sb-*-auth-token` con
 * `Domain=app.<apex>` (subdomain) o sin `Domain` (host-only). Cuando
 * setteamos la cookie nueva con `Domain=<apex>` (apex), el browser termina
 * con DOS o más cookies del mismo nombre. Supabase SSR puede leer la
 * antigua (vía precedencia browser-specific) y `getUser()` falla
 * silenciosamente.
 *
 * Solución: al inicio de cada callback, emitimos `Set-Cookie` con
 * `Max-Age=0` para cada cookie `sb-*-auth-token` presente en el request,
 * en TODOS los domains alternativos posibles. El browser borra las viejas;
 * el handler luego escribe la nueva con `Domain=<apex>` correcto.
 *
 * **Pattern de cookies cubierto:**
 * - `sb-<projectRef>-auth-token` (no chunked)
 * - `sb-<projectRef>-auth-token.0`, `.1`, ...  (chunked cuando session > 4KB)
 *
 * **Domains que limpiamos:**
 * - `Domain=app.<apex>` (subdomain inbox legacy)
 * - host-only (sin Domain) — cookie pegada al host actual
 *
 * NO limpiamos `Domain=<apex>` (la nueva, que el handler escribe después).
 *
 * **Idempotencia:** la función no trackea estado. El caller debe invocarla
 * una vez por request al inicio del handler.
 *
 * Ver ADR `2026-05-10-auth-callbacks-on-apex.md`.
 */
export function cleanupLegacyCookies(req: NextRequest, response: NextResponse): void {
  const apex = clientEnv.NEXT_PUBLIC_APP_DOMAIN.split(':')[0] ?? ''
  const subdomainLegacy = `app.${apex}`

  for (const cookie of req.cookies.getAll()) {
    if (!isSupabaseAuthCookie(cookie.name)) continue

    // Cleanup en subdomain legacy.
    response.cookies.set(cookie.name, '', {
      domain: subdomainLegacy,
      path: '/',
      maxAge: 0,
    })

    // Cleanup host-only (sin Domain) — para cookies que quedaron pegadas
    // al host actual sin Domain attr.
    response.cookies.set(cookie.name, '', {
      path: '/',
      maxAge: 0,
    })
  }
}

const SUPABASE_AUTH_COOKIE_RE = /^sb-[A-Za-z0-9]+-auth-token(\.\d+)?$/

function isSupabaseAuthCookie(name: string): boolean {
  return SUPABASE_AUTH_COOKIE_RE.test(name)
}
