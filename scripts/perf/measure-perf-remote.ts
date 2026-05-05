/**
 * Modo remoto de `measure-perf.ts` — mide TTFB / FCP / LCP / transferKB
 * contra una URL externa (típicamente un Vercel preview deployment).
 *
 * Diferencias relevantes vs el modo local:
 *
 *   1. NO levanta `pnpm start`. La URL ya está sirviendo prod.
 *   2. NO accede al log Pino del runtime → no se reportan queries Prisma
 *      (`prismaQueryCount`/`prismaTotalMs`/`prismaSlowestMs` quedan en `null`).
 *      Para esa data hay que mirar Vercel Function Logs manualmente.
 *   3. Auth via Supabase admin SDK (`generateLink({ type: 'magiclink' })`):
 *      visitamos el `action_link` con Playwright, dejamos que el callback
 *      del target setee las cookies de sesión. NO usamos `tests/.auth/*.json`
 *      (cookies con domain `.lvh.me`, no sirven en `*.vercel.app`).
 *   4. Subdominios: en Vercel preview SIN dominio custom + wildcard DNS,
 *      `https://{slug}.preview-xxx.vercel.app` retorna 404. Probamos primero
 *      la forma subdomain (puede funcionar si hay custom domain con wildcard);
 *      si falla, fallback a path-based `https://preview-xxx.vercel.app/{slug}/...`.
 *      Si tampoco, abortamos con hint accionable.
 *   5. `bundleKB`: medimos vía `transferSize` de los recursos `.js` cargados
 *      por la page (más fiel que el manifest local).
 *
 * Convenciones de naming: el caller pasa la URL completa (con `https://`).
 * No tocamos `process.env.NEXT_PUBLIC_APP_DOMAIN` ni el `.env.local` — el
 * runtime remoto tiene sus propios envs, los nuestros sólo afectarían si
 * importamos código de la app (que no hacemos en este modo).
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { setTimeout as sleep } from 'node:timers/promises'
import type { Browser, BrowserContext } from '@playwright/test'

import { E2E_BASELINE_POST_SLUG, E2E_EMAILS, E2E_PLACES } from '../../tests/fixtures/e2e-data'

// -----------------------------------------------------------------
// Tipos públicos consumidos por el orquestador en `measure-perf.ts`.
// -----------------------------------------------------------------

export type RemoteRouteSpec = {
  key: string
  label: string
  /** Path relativo del recurso dentro del place (ej: '/conversations'). */
  placePath: string | null
  /** Path absoluto cuando NO depende de un place (ej: '/inbox'). */
  absolutePath: string | null
  /** Opcional: post slug a interpolar en el path (`{post}` literal en placePath). */
  needsPostSlug: boolean
  needsAuth: boolean
}

export type RemoteRouteMetrics = {
  key: string
  label: string
  url: string
  bundleKB: number | null
  ttfbMs: number | null
  fcpMs: number | null
  lcpMs: number | null
  tbtMs: number | null
  domContentLoadedMs: number | null
  loadEventMs: number | null
  transferKB: number | null
  // Siempre `null` en modo remoto — sin acceso al log del runtime.
  prismaQueryCount: number | null
  prismaTotalMs: number | null
  prismaSlowestMs: number | null
}

export type RemoteAccessMode = 'subdomain' | 'path'

export type RemoteContext = {
  /** URL base sin trailing slash, ej: `https://preview-xxx.vercel.app`. */
  baseUrl: string
  /** Hostname sin protocolo, ej: `preview-xxx.vercel.app`. */
  baseHost: string
  /** True si el hostname coincide con `*.vercel.app`. */
  isVercelPreview: boolean
  /** Cómo construimos la URL de gated routes. */
  accessMode: RemoteAccessMode
  /** Storage state path con cookies post-magiclink. */
  storageStatePath: string
}

// -----------------------------------------------------------------
// Routes definidas por key — equivalente al ROUTES local pero sin host
// (la URL final se compone con `buildRouteUrl` según `accessMode`).
// -----------------------------------------------------------------

export const REMOTE_ROUTES: RemoteRouteSpec[] = [
  {
    key: 'inbox',
    label: '/inbox',
    placePath: null,
    absolutePath: '/inbox',
    needsPostSlug: false,
    needsAuth: true,
  },
  {
    key: 'conversations',
    label: '/{place}/conversations',
    placePath: '/conversations',
    absolutePath: null,
    needsPostSlug: false,
    needsAuth: true,
  },
  {
    key: 'post-detail',
    label: '/{place}/conversations/{post}',
    placePath: `/conversations/${E2E_BASELINE_POST_SLUG}`,
    absolutePath: null,
    needsPostSlug: true,
    needsAuth: true,
  },
  {
    key: 'library',
    label: '/{place}/library',
    placePath: '/library',
    absolutePath: null,
    needsPostSlug: false,
    needsAuth: true,
  },
]

// -----------------------------------------------------------------
// CLI helpers
// -----------------------------------------------------------------

export function parseTargetUrl(raw: string): { baseUrl: string; baseHost: string } {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    throw new Error(
      `[perf:remote] --target-url inválido: "${raw}". Esperado: https://host.tld (o http://...)`,
    )
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(
      `[perf:remote] protocol no soportado: ${parsed.protocol}. Usá http:// o https://.`,
    )
  }
  // Normalizamos: sin trailing slash, sin pathname, sin search.
  const baseUrl = `${parsed.protocol}//${parsed.host}`
  return { baseUrl, baseHost: parsed.host }
}

// -----------------------------------------------------------------
// URL building con detección subdomain vs path-based.
// -----------------------------------------------------------------

/**
 * Compone la URL final para una `RemoteRouteSpec` dado el modo de acceso.
 *
 *   subdomain → `https://{slug}.{baseHost}{path}`
 *   path      → `https://{baseHost}/{slug}{path}`
 *
 * Para rutas absolutas (ej: /inbox), siempre usamos `app.{baseHost}` en
 * subdomain mode y `/inbox` directo en path mode (el middleware del runtime
 * remoto se encarga de mapear `app` → /inbox cuando NEXT_PUBLIC_APP_DOMAIN
 * está bien seteado; en path mode dejamos que Next sirva /inbox como ruta
 * literal del app router, que existe).
 */
export function buildRouteUrl(
  spec: RemoteRouteSpec,
  ctx: RemoteContext,
  placeSlug: string,
): string {
  if (spec.absolutePath !== null) {
    if (ctx.accessMode === 'subdomain') {
      return `${ctx.baseUrl.replace(ctx.baseHost, `app.${ctx.baseHost}`)}${spec.absolutePath}`
    }
    return `${ctx.baseUrl}${spec.absolutePath}`
  }
  // Place-scoped path
  const path = spec.placePath ?? ''
  if (ctx.accessMode === 'subdomain') {
    return `${ctx.baseUrl.replace(ctx.baseHost, `${placeSlug}.${ctx.baseHost}`)}${path}`
  }
  return `${ctx.baseUrl}/${placeSlug}${path}`
}

// -----------------------------------------------------------------
// Auth — magiclink generado vía admin SDK + visit del action_link
// para que el callback del target setee las cookies de sesión.
// -----------------------------------------------------------------

function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      '[perf:remote] Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el env. ' +
        'Correr vía `pnpm perf` (carga .env.local) o exportar manualmente antes.',
    )
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/**
 * Genera magiclink para `email` con `redirectTo` apuntando al callback del
 * target. Devuelve la URL del verify endpoint de Supabase — al visitarla,
 * Supabase 302 a `<target>/auth/callback?code=...&next=...`, el callback
 * del target hace exchange y termina seteando cookies del dominio del
 * target en el browser.
 *
 * El `next` que pasamos es `<baseUrl>/inbox` — una página gated cualquiera,
 * sólo importa que sea válida para que el callback no rebote a /login.
 */
async function generateMagicLinkActionUrl(ctx: RemoteContext, email: string): Promise<string> {
  const supabaseAdmin = getSupabaseAdmin()

  // Vercel preview: el callback debe vivir en el `baseUrl`. En subdomain mode
  // intentamos `app.{host}` para que el cookie domain post-callback abarque
  // todos los subdominios; en path mode usamos directo el `baseHost`.
  const callbackHost = ctx.accessMode === 'subdomain' ? `app.${ctx.baseHost}` : ctx.baseHost
  const protocol = ctx.baseUrl.startsWith('https:') ? 'https:' : 'http:'
  const redirectTo = `${protocol}//${callbackHost}/auth/callback?next=${encodeURIComponent(`${ctx.baseUrl}/inbox`)}`

  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo },
  })
  if (error || !data?.properties?.action_link) {
    throw new Error(
      `[perf:remote] generateLink falló para ${email}: ${error?.message ?? 'sin action_link'}.\n` +
        '       Verificá que el user E2E exista (`pnpm test:e2e:seed`) y que SUPABASE_SERVICE_ROLE_KEY sea válida.',
    )
  }
  return data.properties.action_link
}

/**
 * Crea un browser context, visita el `action_link`, espera al landing
 * post-callback, y persiste el storageState con cookies del dominio target.
 *
 * Caveat: el callback del target hace 1 query Prisma (upsert User). Si la
 * DB del target NO tiene los users E2E sembrados (ej: branch nueva), el
 * upsert los crea automáticamente — pero las membresías de places no, así
 * que las gated routes pueden retornar 403/redirect. En ese caso hay que
 * correr el seed contra el DB del target ANTES de medir.
 */
export async function authenticateAgainstRemote(
  browser: Browser,
  ctx: RemoteContext,
  email: string,
  storageStatePath: string,
): Promise<void> {
  const actionUrl = await generateMagicLinkActionUrl(ctx, email)
  const context = await browser.newContext({ ignoreHTTPSErrors: false })
  const page = await context.newPage()
  // Visita: Supabase verify → 302 callback → 302 inbox. waitUntil 'load'
  // para asegurar que las cookies del callback ya viajaron al browser.
  const res = await page.goto(actionUrl, { waitUntil: 'load', timeout: 30_000 })
  const finalStatus = res?.status() ?? 0
  const finalUrl = page.url()
  if (finalStatus >= 400) {
    await context.close()
    throw new Error(
      `[perf:remote] auth flow terminó en status ${finalStatus} (url=${finalUrl}).\n` +
        '       Causa probable: redirectTo no permitido en Supabase Auth → URL Configuration,\n' +
        '       o el callback del target retornó error. Agregá el host a "Redirect URLs" en\n' +
        '       Dashboard → Authentication → URL Configuration.',
    )
  }
  // Si terminamos en /login → el callback rechazó (link inválido o sync falló).
  if (/\/login(\?|$)/.test(finalUrl)) {
    await context.close()
    throw new Error(
      `[perf:remote] auth flow terminó en /login (url=${finalUrl}).\n` +
        '       Causa probable: el callback del target NO ejecutó exchangeCodeForSession\n' +
        '       (revisá Vercel Function Logs de /auth/callback) o el redirectTo no está\n' +
        '       en la allowlist de Supabase Auth.',
    )
  }
  await context.storageState({ path: storageStatePath })
  await context.close()
}

// -----------------------------------------------------------------
// Sanity checks contra el target.
// -----------------------------------------------------------------

/**
 * Pre-flight: el target debe responder 200 en `/api/health`.
 *
 * Si no responde → URL incorrecta, deployment caído, o sanity guard de
 * env vars del runtime falló. El reporte abreviado lo discrimina por
 * el status code.
 */
export async function assertHealthy(baseUrl: string): Promise<void> {
  const url = `${baseUrl}/api/health`
  let res: Response
  try {
    res = await fetch(url, { method: 'GET' })
  } catch (err) {
    throw new Error(
      `[perf:remote] /api/health no respondió (${(err as Error).message}). ` +
        `URL: ${url}. Verificá que el deployment esté ACTIVE y la URL sea correcta.`,
    )
  }
  if (!res.ok) {
    throw new Error(
      `[perf:remote] /api/health retornó ${res.status} en ${url}. ` +
        'Probablemente la URL no apunta a una instancia de la app Place.',
    )
  }
}

/**
 * Detecta el modo de acceso (subdomain vs path) probando una gated route con
 * el storageState ya autenticado. Si subdomain devuelve 404 → fallback path.
 * Si ambos fallan → throw con hint claro.
 *
 * Estrategia:
 *   1. Probar subdomain mode primero (es lo que la app espera nativamente).
 *   2. Si 404 / DNS error → probar path-based (puede funcionar si el
 *      runtime remoto cae a `kind: marketing` y Next sirve `/[placeSlug]/...`
 *      como ruta literal del app router).
 *   3. Si tampoco funciona → fallar con hint accionable.
 */
export async function detectAccessMode(
  browser: Browser,
  baseCtx: Omit<RemoteContext, 'accessMode'>,
  placeSlug: string,
): Promise<RemoteAccessMode> {
  const probe = async (mode: RemoteAccessMode): Promise<number> => {
    const ctx = { ...baseCtx, accessMode: mode }
    const url = buildRouteUrl(
      {
        key: 'probe',
        label: 'probe',
        placePath: '/conversations',
        absolutePath: null,
        needsPostSlug: false,
        needsAuth: true,
      },
      ctx,
      placeSlug,
    )
    const browserCtx = await browser.newContext({ storageState: baseCtx.storageStatePath })
    const page = await browserCtx.newPage()
    try {
      const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15_000 })
      return res?.status() ?? 0
    } catch {
      return 0
    } finally {
      await browserCtx.close()
    }
  }

  console.log('[perf:remote] sanity check: probing subdomain mode...')
  const subdomainStatus = await probe('subdomain')
  if (subdomainStatus === 200) {
    console.log('[perf:remote] subdomain mode OK (status 200)')
    return 'subdomain'
  }
  console.log(
    `[perf:remote] subdomain mode falló (status ${subdomainStatus}). Probando path-based...`,
  )
  const pathStatus = await probe('path')
  if (pathStatus === 200) {
    console.log('[perf:remote] path-based mode OK (status 200)')
    return 'path'
  }

  // Ambos modos fallaron. Distinguir 401/302 (auth) vs 404 (DNS/routing).
  const hint =
    subdomainStatus === 401 || subdomainStatus === 302 || pathStatus === 401 || pathStatus === 302
      ? 'cookies de sesión no aplicaron al target — posible cookie domain mismatch o user E2E sin membership en el DB del runtime'
      : baseCtx.isVercelPreview
        ? 'Vercel preview sin dominio custom no soporta wildcard DNS — agregá un custom domain con wildcard, o testeá path-based asegurando que NEXT_PUBLIC_APP_DOMAIN del runtime coincida con el host del preview'
        : 'verificá que el deployment esté servido en este host y que el seed E2E haya corrido contra su DB'

  throw new Error(
    `[perf:remote] ninguna gated route respondió 200 (subdomain=${subdomainStatus}, path=${pathStatus}).\n` +
      `       Hint: ${hint}.`,
  )
}

// -----------------------------------------------------------------
// Medición por route — Playwright contra el target.
// -----------------------------------------------------------------

export async function measureRemoteRoute(
  browser: Browser,
  spec: RemoteRouteSpec,
  ctx: RemoteContext,
  placeSlug: string,
): Promise<RemoteRouteMetrics> {
  const url = buildRouteUrl(spec, ctx, placeSlug)
  const browserCtx: BrowserContext = await browser.newContext(
    spec.needsAuth ? { storageState: ctx.storageStatePath } : {},
  )
  const page = await browserCtx.newPage()

  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  if (!response) {
    await browserCtx.close()
    throw new Error(`[perf:remote] sin response para ${url}`)
  }
  if (response.status() !== 200) {
    await browserCtx.close()
    throw new Error(
      `[perf:remote] ${spec.label} retornó status ${response.status()} (url=${url}). ` +
        'Verificá auth + access mode antes de medir.',
    )
  }

  // Mismo budget que en local — networkidle 5s o el que llegue antes.
  await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined)
  await sleep(300)

  const metrics = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] as
      | PerformanceNavigationTiming
      | undefined
    const fcpEntry = performance
      .getEntriesByType('paint')
      .find((e) => e.name === 'first-contentful-paint')
    const lcpList = performance.getEntriesByType('largest-contentful-paint')
    const lcp = lcpList[lcpList.length - 1] as { startTime?: number } | undefined

    let totalTransfer = 0
    let totalScriptTransfer = 0
    for (const r of performance.getEntriesByType('resource') as PerformanceResourceTiming[]) {
      const size = r.transferSize ?? 0
      totalTransfer += size
      // Script chunks .js cargados como `script`. `initiatorType` discrimina
      // de fetch/xhr (RSC payload, etc) — eso NO cuenta como First Load JS.
      if (r.initiatorType === 'script' && /\.js(\?|$)/.test(r.name)) {
        totalScriptTransfer += size
      }
    }
    if (nav) totalTransfer += nav.transferSize ?? 0

    let tbt: number | null = null
    try {
      const longTasks = performance.getEntriesByType('longtask') as PerformanceEntry[]
      tbt = longTasks.reduce((sum, t) => sum + Math.max(0, t.duration - 50), 0)
    } catch {
      tbt = null
    }

    return {
      ttfbMs: nav ? Math.round(nav.responseStart - nav.requestStart) : null,
      fcpMs: fcpEntry ? Math.round(fcpEntry.startTime) : null,
      lcpMs: lcp?.startTime != null ? Math.round(lcp.startTime) : null,
      tbtMs: tbt,
      domContentLoadedMs: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
      loadEventMs: nav ? Math.round(nav.loadEventEnd) : null,
      transferKB: Math.round((totalTransfer / 1024) * 10) / 10,
      scriptTransferKB: Math.round((totalScriptTransfer / 1024) * 10) / 10,
    }
  })

  await browserCtx.close()

  return {
    key: spec.key,
    label: spec.label,
    url,
    bundleKB: metrics.scriptTransferKB,
    ttfbMs: metrics.ttfbMs,
    fcpMs: metrics.fcpMs,
    lcpMs: metrics.lcpMs,
    tbtMs: metrics.tbtMs,
    domContentLoadedMs: metrics.domContentLoadedMs,
    loadEventMs: metrics.loadEventMs,
    transferKB: metrics.transferKB,
    prismaQueryCount: null,
    prismaTotalMs: null,
    prismaSlowestMs: null,
  }
}

// -----------------------------------------------------------------
// Helpers de info — el principal los usa para el header del reporte.
// -----------------------------------------------------------------

export function defaultPlaceSlug(): string {
  return E2E_PLACES.palermo.slug
}

export function defaultAuthEmail(): string {
  return E2E_EMAILS.owner
}

export function isVercelPreviewHost(host: string): boolean {
  return /\.vercel\.app$/i.test(host)
}
