import { clientEnv } from '@/shared/config/env'
import { logger } from './logger'
import { apexUrl, inboxUrl, placeUrl, assertValidSlug } from './app-url'
import { SAFE_NEXT_PATTERNS } from '@/app/auth/callback/helpers'

/**
 * Resuelve un `next` (path relativo o URL absoluta) a una URL absoluta con
 * el host correcto del producto multi-subdomain.
 *
 * **Por qué este helper:** los callbacks (`/auth/callback`,
 * `/auth/invite-callback`) corren en apex (ver
 * `src/shared/lib/auth-callback-url.ts`). El redirect post-callback debe
 * apuntar al host correcto basado en el path destino:
 *
 * - Paths "globales" (`/invite/accept/<tok>`, `/login`, `/auth/callback`) →
 *   apex. Esas pages no viven bajo `/app/inbox/` ni `/app/[placeSlug]/`,
 *   solo el middleware caso `marketing` (apex) las sirve sin rewrite.
 * - `/inbox` y subpaths → subdomain `app.<apex>`. El middleware caso `inbox`
 *   reescribe `/<rest>` → `/inbox/<rest>`. **Atención:** `/inbox` literal
 *   se mapea al ROOT del subdomain (resultado `app.<apex>/`) — sino el
 *   rewrite produciría `/inbox/inbox` que no existe en filesystem y daría
 *   404. Otros subpaths (`/inbox/places/new`) se mapean dropping el prefijo
 *   `/inbox` para que el rewrite resulte en `/inbox/places/new` (que sí
 *   existe).
 * - `/<slug>/(conversations|library|events|m/<id>|settings)(/...)?` →
 *   subdomain `<slug>.<apex>` con el subpath. Slug se valida contra
 *   `SLUG_RE` de `app-url.ts` (cierra el bug histórico `%20`).
 * - URL absoluta same-host (apex o cualquier `*.<apex>`) → aceptada tal cual.
 * - URL cross-origin, malformada, o path no en `SAFE_NEXT_PATTERNS` →
 *   fallback al inbox subdomain root, con warn.
 *
 * Reusa `SAFE_NEXT_PATTERNS` de `auth/callback/helpers.ts` como única
 * fuente de verdad de paths permitidos.
 */
export function resolveNextRedirect(rawNext: string | null): URL {
  const fallback = inboxUrl('/')
  if (!rawNext) return fallback

  if (isAbsoluteUrl(rawNext)) {
    return resolveAbsoluteNext(rawNext, fallback)
  }

  return resolveRelativeNext(rawNext, fallback)
}

const log = logger.child({ scope: 'shared/next-redirect' })

const PLACE_SUBPATH_RE =
  /^\/([a-z0-9-]+)\/(conversations|library|events|m\/[a-z0-9-]+|settings)(\/.*)?$/

const APEX_GLOBAL_PATHS_RE =
  /^(\/invite\/accept\/[A-Za-z0-9_-]+|\/login|\/auth\/callback|\/auth\/invite-callback)$/

function isAbsoluteUrl(s: string): boolean {
  // Cubre `http://`, `https://`, y protocol-relative `//`.
  return /^([a-z][a-z0-9+.-]*:)?\/\//i.test(s)
}

function resolveRelativeNext(rawNext: string, fallback: URL): URL {
  // Normalizar path traversal antes de matchear (resolver `..` etc).
  let normalized: string
  try {
    normalized = new URL(rawNext, 'https://placeholder.invalid').pathname
  } catch {
    log.warn({ rawNext }, 'next_redirect_invalid_url')
    return fallback
  }

  // Allowlist defensiva: cualquier path que NO matchee SAFE_NEXT_PATTERNS
  // cae a fallback con warn.
  if (!SAFE_NEXT_PATTERNS.some((re) => re.test(normalized))) {
    log.warn({ rawNext, pathname: normalized }, 'next_redirect_unknown_path')
    return fallback
  }

  // Mapear a host correcto según el pattern.
  if (APEX_GLOBAL_PATHS_RE.test(normalized)) {
    return apexUrl(normalized)
  }

  if (normalized === '/inbox') {
    return inboxUrl('/')
  }

  if (normalized.startsWith('/inbox/')) {
    return inboxUrl(normalized.slice('/inbox'.length))
  }

  const placeMatch = normalized.match(PLACE_SUBPATH_RE)
  if (placeMatch) {
    const [, slug, , rest] = placeMatch
    if (!slug) return fallback
    try {
      assertValidSlug(slug)
    } catch {
      log.warn({ rawNext, slug }, 'next_redirect_invalid_slug')
      return fallback
    }
    const tail = rest ?? ''
    const subpath = `/${normalized.slice(slug.length + 2)}` // descarta `/${slug}/`
    // `subpath` ahora es `/conversations` o `/conversations/whatever`.
    void tail
    return placeUrl(slug, subpath)
  }

  // Defensivo: matchéo pero no pudimos mapear (no debería pasar).
  log.warn({ rawNext, pathname: normalized }, 'next_redirect_unmapped_path')
  return fallback
}

function resolveAbsoluteNext(rawNext: string, fallback: URL): URL {
  let candidate: URL
  try {
    candidate = new URL(rawNext)
  } catch {
    log.warn({ rawNext }, 'next_redirect_invalid_url')
    return fallback
  }

  const apex = clientEnv.NEXT_PUBLIC_APP_DOMAIN.split(':')[0] ?? ''
  const host = candidate.hostname

  // Aceptar apex o cualquier subdomain del apex (`<slug>.apex`, `app.apex`).
  // Cross-origin → fallback.
  const isSameOrigin = host === apex || host.endsWith(`.${apex}`)
  if (!isSameOrigin) {
    log.warn({ rawNext, candidateHost: host, apex }, 'next_redirect_cross_origin')
    return fallback
  }

  // Path validation: para URLs absolutas confiamos en que vienen de nuestro
  // propio gate del middleware (`originalUrl` capturado pre-login). Los paths
  // del subdomain inbox/place llegan SIN el slug-prefix lógico — el slug ya
  // está en el host, no en el path. Por eso no aplicamos `SAFE_NEXT_PATTERNS`
  // acá: si la URL ya pasó nuestro gate, su path es legítimo. Si Next no
  // encuentra la ruta, sirve 404 naturalmente.
  return candidate
}
