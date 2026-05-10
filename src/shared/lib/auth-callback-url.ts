import { clientEnv } from '@/shared/config/env'

/**
 * Construye URL absoluta del `/auth/callback?next=...` para usar como
 * `redirectTo` cuando se generan magic links via Supabase Admin API.
 *
 * **Por qué pasar por callback:** `generateLink({ type: 'invite' | 'magiclink' })`
 * de Supabase devuelve un `action_link` que al clickearse hace token verify
 * y redirige a `redirect_to` con `?code=<jwt>` query param. Para que esa
 * sesión se materialice como cookie en el browser HAY QUE llamar
 * `exchangeCodeForSession(code)` — eso solo lo hace nuestro
 * `/auth/callback` route (`src/app/auth/callback/route.ts`).
 *
 * Si el `redirect_to` salta directo al destino final (ej:
 * `/invite/accept/{token}`), la página llega sin sesión y el guard la
 * redirige a `/login`. Resultado: el user tiene que tipear su email para
 * recibir un SEGUNDO magic link — fricción inaceptable + bug reportado
 * en producción 2026-05-09.
 *
 * **Side effect requerido:** el `nextPath` que pases acá tiene que estar
 * en `SAFE_NEXT_PATTERNS` de `src/app/auth/callback/helpers.ts`. Sino el
 * callback va a fallback al inbox por security guard.
 *
 * Ver también: `docs/features/auth/spec.md` y
 * `src/app/auth/callback/route.ts`.
 */
export function authCallbackUrlForNext(nextPath: string): string {
  const next = nextPath.startsWith('/') ? nextPath : `/${nextPath}`
  return `${clientEnv.NEXT_PUBLIC_APP_URL}/auth/callback?next=${encodeURIComponent(next)}`
}
