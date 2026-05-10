import 'server-only'
import { NextResponse, type NextRequest } from 'next/server'
import { clientEnv } from '@/shared/config/env'
import { logger } from '@/shared/lib/logger'

/**
 * Cleanup proactivo de cookies sb-{currentRef}-auth-token DUPLICADAS en el
 * Cookie header del request. Cuando el browser tiene 2 cookies con el mismo
 * name (típicamente: una con Domain=apex emitida por el callback + otra
 * host-only residual de un flow viejo pre-fix), ambas viajan en el header
 * y el SDK `@supabase/ssr` lee la primera (RFC 6265 § 5.3 step 6: host-only
 * tiene precedencia → aparece primero). Si esa es la residual invalidada,
 * `getSession()` falla con `refresh_token_not_found` y el user es redirigido
 * a `/login`.
 *
 * Approach proactivo: parsear el raw `cookie` header (no `req.cookies.getAll()`
 * que deduplica internamente y oculta las duplicadas), detectar el caso, y
 * emitir Set-Cookie `Max-Age=0` host-only para borrar la residual + redirect
 * al mismo URL. El browser:
 *  1. Aplica los Set-Cookie → borra la residual host-only
 *  2. Sigue el redirect → mismo URL pero ahora cookies limpias
 *  3. SDK lee la cookie apex correcta → getSession OK
 *
 * Ventaja vs cleanup reactivo: el user NO ve /login. Ve un redirect
 * transparente (mismo URL, distinto query/fragment imperceptible) al place.
 *
 * Ver `docs/decisions/2026-05-10-cookie-residual-host-only-cleanup.md`
 * (Sesión 3 del plan de hardening).
 */
export function buildProactiveResidualCleanupResponse(req: NextRequest): NextResponse | null {
  const rawHeader = req.headers.get('cookie')
  if (!rawHeader) return null

  const currentRef = clientEnv.NEXT_PUBLIC_SUPABASE_URL.match(/https:\/\/([^.]+)\./)?.[1] ?? null
  if (!currentRef) return null

  const duplicatedNames = findDuplicatedAuthTokenCookies(rawHeader, currentRef)
  if (duplicatedNames.length === 0) return null

  // Construir redirect al mismo URL con Set-Cookie maxAge=0 host-only.
  const response = NextResponse.redirect(req.url, { status: 307 })
  for (const name of duplicatedNames) {
    response.headers.append('Set-Cookie', `${name}=; Path=/; Max-Age=0; Secure; SameSite=Lax`)
  }

  const host = req.headers.get('host') ?? '?'
  const path = req.nextUrl.pathname
  logger.warn(
    {
      debug: 'MW_proactive_cleanup',
      host,
      path,
      currentRef,
      duplicatedCount: duplicatedNames.length,
      duplicatedNames,
    },
    `DBG MW[proactive-cleanup] host=${host} path=${path} ref=${currentRef} duplicated=${duplicatedNames.length} names=[${duplicatedNames.join(',')}] → redirecting to same URL with Set-Cookie maxAge=0`,
  )

  return response
}

/**
 * Parsea el raw `cookie` header buscando cookies con name `sb-{currentRef}-auth-token`
 * (incluyendo chunks `.0`, `.1`, ...) que aparezcan más de una vez. Retorna la
 * lista de names duplicados (deduplicada).
 *
 * Por qué parsear raw: `req.cookies.getAll()` de NextRequest ya deduplica
 * internamente (toma una entrada por name), ocultando el problema. Necesitamos
 * el header raw del browser para verlo.
 *
 * Edge cases manejados:
 *  - Whitespace alrededor de `;` (RFC 6265 permite cualquier cantidad)
 *  - Empty values (`name=`)
 *  - Quoted values (`name="value with ; inside"`) — cookies comunes no usan
 *    quotes, pero el SDK Supabase a veces emite valores codificados; el
 *    parser ignora `=` después del primero
 */
export function findDuplicatedAuthTokenCookies(rawHeader: string, currentRef: string): string[] {
  // Pattern para matchear el name target. Aceptamos chars alphanuméricos +
  // `_` + `-` (los que Supabase usa para project refs y chunk indices).
  const targetNameRe = new RegExp(`^sb-${escapeRegex(currentRef)}-auth-token(?:\\.\\d+)?$`)

  const counts = new Map<string, number>()
  // Split por `;` y trim cada segment.
  for (const segment of rawHeader.split(';')) {
    const trimmed = segment.trim()
    if (!trimmed) continue
    const eq = trimmed.indexOf('=')
    const name = eq === -1 ? trimmed : trimmed.slice(0, eq)
    if (!targetNameRe.test(name)) continue
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }

  return [...counts.entries()].filter(([, n]) => n > 1).map(([name]) => name)
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
