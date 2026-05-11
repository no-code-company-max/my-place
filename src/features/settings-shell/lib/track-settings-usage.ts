/**
 * Tracking de uso de sub-pages de settings (`/settings/<slug>`) en el browser
 * vía `localStorage`. Alimenta el `<FrequentlyAccessedHub>` mobile que muestra
 * top-N settings más usadas como atajo en `/settings` raíz.
 *
 * **Privacy**: el tracking es 100% client-side, no se envía al server. Ningún
 * dato personal — solo nombres de slugs estáticos (`hours`, `members`, etc.)
 * y un contador entero. Reset con `resetUsage()` o limpiando localStorage.
 *
 * **SSR safety**: todas las funciones detectan `typeof window === 'undefined'`
 * y son no-op (track) o retornan `[]` (read). Safe para Server Components que
 * importen indirectamente.
 *
 * Ver `docs/plans/2026-05-10-settings-desktop-redesign.md` § "Sesión 6".
 */

export const STORAGE_KEY = 'place_settings_usage_v1'

type UsageCounts = Record<string, number>

export type UsageEntry = {
  slug: string
  count: number
}

/**
 * Registra una visita a `/settings/<slug>`. No-op si:
 *  - `pathname` no matchéa `/settings/<slug>` (ej. `/conversations`).
 *  - `pathname` es exactamente `/settings` (root, no es sub-page).
 *  - Estamos en SSR (`window === undefined`).
 *
 * Para sub-paths profundos (`/settings/groups/<id>`) extrae solo el primer
 * segment (`groups`) — track por sub-page, no por item específico.
 */
export function trackSettingsUsage(pathname: string): void {
  if (typeof window === 'undefined') return
  const slug = extractSettingsSlug(pathname)
  if (!slug) return

  try {
    const counts = readCounts()
    counts[slug] = (counts[slug] ?? 0) + 1
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(counts))
  } catch {
    // localStorage puede fallar (quota exceeded, private browsing en algunos
    // browsers). El tracking es opcional; fallar silenciosamente.
  }
}

/**
 * Retorna top-N settings ordenados por count descendente. Empate: orden
 * alfabético por slug (determinístico). Default `topN = 3`.
 *
 * Retorna `[]` en SSR o si no hay tracking previo o si el localStorage está
 * corrupto.
 */
export function getTopUsage(topN: number = 3): UsageEntry[] {
  if (typeof window === 'undefined') return []
  const counts = readCounts()
  return Object.entries(counts)
    .map(([slug, count]) => ({ slug, count }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count
      return a.slug.localeCompare(b.slug)
    })
    .slice(0, topN)
}

/** Limpia el tracking. Útil para tests y para una eventual UI de "Reset". */
export function resetUsage(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* noop */
  }
}

// ---------- internals ----------

function readCounts(): UsageCounts {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}
    // Validamos shape: solo entries `string -> number positive integer`
    const valid: UsageCounts = {}
    for (const [slug, count] of Object.entries(parsed)) {
      if (typeof slug === 'string' && typeof count === 'number' && count > 0) {
        valid[slug] = count
      }
    }
    return valid
  } catch {
    return {}
  }
}

function extractSettingsSlug(pathname: string): string | null {
  // Match `/settings/<slug>` o `/settings/<slug>/...` — extrae solo el slug.
  // NO matchéa `/settings` raíz ni paths fuera de `/settings/`.
  const match = pathname.match(/^\/settings\/([a-z][a-z0-9-]*)/)
  return match?.[1] ?? null
}
