import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/**
 * Safety net del aislamiento entre features y capas.
 *
 * Parsea estáticamente los imports de `src/` y valida:
 * 1. Ninguna feature importa archivos internos de otra (solo `public.ts`).
 * 2. `shared/` no importa de `features/`.
 *
 * Complementa la regla ESLint — si alguien bypassa ESLint, el test falla el build.
 * Ver `docs/architecture.md` § "Reglas de aislamiento entre módulos".
 */

const SRC_ROOT = join(__dirname, '..', 'src')
const IMPORT_REGEX = /from\s+['"]([^'"]+)['"]/g

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      out.push(...walk(full))
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full)
    }
  }
  return out
}

function importsOf(file: string): string[] {
  const content = readFileSync(file, 'utf8')
  const imports: string[] = []
  let match: RegExpExecArray | null
  while ((match = IMPORT_REGEX.exec(content)) !== null) {
    const path = match[1]
    if (path !== undefined) imports.push(path)
  }
  return imports
}

describe('boundaries entre capas (docs/architecture.md)', () => {
  const files = walk(SRC_ROOT)

  it('ningún archivo fuera de una feature importa internals de una feature (solo public.ts)', () => {
    const violations: string[] = []
    for (const file of files) {
      const rel = relative(SRC_ROOT, file)
      // Las features pueden importar de sus propios internals, skip.
      const inFeatureMatch = rel.match(/^features\/([^/]+)\//)
      const ownFeature = inFeatureMatch?.[1]

      for (const imp of importsOf(file)) {
        const m = imp.match(/^@\/features\/([^/]+)\/(.+)$/)
        if (!m) continue
        const [, feature, rest] = m
        if (feature === undefined || rest === undefined) continue
        if (feature === ownFeature) continue
        // Allowed cross-slice entries:
        //  - barrel raíz: `public` | `public.server` (regla original)
        //  - sub-slice public: `<sub>/public` | `<sub>/public.server`
        //    (sólo un nivel de anidación — evita anidar arbitrariamente).
        // Ver `docs/decisions/2026-05-08-sub-slice-cross-public.md`.
        if (
          rest === 'public' ||
          rest === 'public.ts' ||
          rest === 'public.server' ||
          rest === 'public.server.ts' ||
          /^[a-z0-9-]+\/public(\.ts)?$/.test(rest) ||
          /^[a-z0-9-]+\/public\.server(\.ts)?$/.test(rest)
        ) {
          continue
        }
        violations.push(`${rel} → @/features/${feature}/${rest}`)
      }
    }
    expect(violations, `violaciones:\n${violations.join('\n')}`).toEqual([])
  })

  it('shared/ no importa de features/', () => {
    const violations: string[] = []
    for (const file of files) {
      const rel = relative(SRC_ROOT, file)
      if (!rel.startsWith('shared/')) continue
      for (const imp of importsOf(file)) {
        if (imp.startsWith('@/features/')) {
          violations.push(`${rel} → ${imp}`)
        }
      }
    }
    expect(violations, `violaciones:\n${violations.join('\n')}`).toEqual([])
  })

  it('ningún archivo de una feature importa OTRA feature vía path relativo profundo (bypass de alias)', () => {
    // El check anterior sólo matchea `@/features/X/Y`. Un import tipo
    // `../../features/X/public` (relativo profundo que sale del slice y
    // vuelve a entrar) bypasea el alias pero viola el boundary. Este
    // regex caza ≥2 niveles hacia arriba aterrizando en `features/`:
    // desde `src/features/<X>/**`, cualquier `../../features/...` cae
    // necesariamente en OTRO slice o en `src/features/` (ambos violan).
    const RELATIVE_CROSS_REGEX = /^(?:\.\.\/){2,}features\//
    const violations: string[] = []
    for (const file of files) {
      const rel = relative(SRC_ROOT, file)
      if (!rel.startsWith('features/')) continue
      for (const imp of importsOf(file)) {
        if (RELATIVE_CROSS_REGEX.test(imp)) {
          violations.push(`${rel} → ${imp}`)
        }
      }
    }
    expect(violations, `violaciones:\n${violations.join('\n')}`).toEqual([])
  })

  it('cookies sb-* siempre con Domain explícito (excepto cleanup defensivo intencional)', () => {
    // Regla: TODA Set-Cookie de `sb-*-auth-token` (session de Supabase) DEBE
    // setear `Domain=<apex>` explícito vía `cookieDomain()` o equivalente.
    // Cookies host-only (sin Domain attribute) en subdomains place sobrescriben
    // las del apex y rompen `getSession()` (RFC 6265 § 5.3 step 6 — host-only
    // tiene precedencia). Bug reproducido y documentado en
    // `docs/decisions/2026-05-10-cookie-residual-host-only-cleanup.md`.
    //
    // Excepciones intencionales (whitelisted abajo):
    //  - cleanup defensivo del middleware con Max-Age=0 (limpieza de residuales)
    //  - buildLegacyCookieCleanup que emite host-only Max-Age=0 explícitamente
    //  - test endpoints DEBUG TEMPORAL (`/api/test-set-cookie`,
    //    `/api/test-callback-sim`) que sirven para diagnóstico
    //
    // Algoritmo: para cada archivo .ts/.tsx en `src/` que contenga el string
    // `sb-` cerca de un Set-Cookie/.cookies.set call, verificar que el call
    // site (mismas ~5 líneas) incluya `domain` o esté en la whitelist.
    const ALLOWED_HOST_ONLY_FILES = new Set([
      // Cleanup defensivo: emite host-only intencionalmente para limpiar residuales
      'shared/lib/supabase/middleware.ts',
      'shared/lib/supabase/cookie-cleanup.ts',
      // DEBUG TEMPORAL endpoints (sirven para diagnóstico, intencionalmente
      // setean cookies con varios Domain incluyendo host-only para test)
      'app/api/test-set-cookie/route.ts',
      // boundaries test mismo (este archivo) menciona los strings literalmente
      '../tests/boundaries.test.ts',
    ])

    const violations: string[] = []

    for (const file of files) {
      const rel = relative(SRC_ROOT, file)
      if (ALLOWED_HOST_ONLY_FILES.has(rel)) continue
      const content = readFileSync(file, 'utf8')
      // Heuristic: si el archivo emite Set-Cookie literal con string `sb-` o
      // hace `.cookies.set('sb-...` o `.set("sb-...`, verificar domain en
      // ventana ±5 líneas. Capturamos call sites con literal sb-* hardcodeado.
      const literalRe = /['"`]sb-[A-Za-z0-9_-]+/g
      const lines = content.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? ''
        if (!literalRe.test(line)) continue
        literalRe.lastIndex = 0 // reset para próxima iteración
        // Ventana de contexto: ±5 líneas alrededor de la línea con literal sb-*
        const start = Math.max(0, i - 5)
        const end = Math.min(lines.length, i + 6)
        const window = lines.slice(start, end).join('\n')
        // Si la ventana NO menciona `domain` ni `Domain=` ni `cookieDomain`,
        // y aparenta ser un Set-Cookie/cookies.set call → violación.
        const isCookieWrite =
          /\.cookies\.set\(|\.cookies\.delete\(|cookieStore\.set\(|cookieStore\.delete\(|appendSetCookie|headers\.append\(['"]Set-Cookie/.test(
            window,
          )
        if (!isCookieWrite) continue
        const hasDomain = /\bdomain\b|\bDomain=|\bcookieDomain\b/.test(window)
        if (!hasDomain) {
          violations.push(`${rel}:${i + 1} → cookies sb-* sin Domain explícito`)
        }
      }
    }
    expect(violations, `violaciones:\n${violations.join('\n')}`).toEqual([])
  })
})
