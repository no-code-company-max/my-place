# Auth callbacks viven en APEX + host-aware redirect post-callback

**Fecha:** 2026-05-10
**Estado:** Aceptada
**Origen:** Reportes en producción 2026-05-09 / 2026-05-10 — invitations entregadas via Resend SMTP, link clickeado por user nuevo en browser limpio caía en `/login`. Hipótesis previas (cookies viejas, race con `onAuthStateChange`) descartadas tras instrumentación: las cookies SÍ se setteaban server-side (`auth.users.last_sign_in_at` y `auth.sessions` confirmaban login) pero la accept page rendeaba 404 global de Next ("No existe. Lo que buscabas no vive acá."). El bug raíz era de **host routing del redirect post-callback**, agravado por una **race con cookies de SDK SSR** que se solucionó adoptando el patrón canónico de Next 15.

## Contexto

`NEXT_PUBLIC_APP_URL` en producción está configurada como `https://app.place.community` (subdomain inbox). Los helpers `authCallbackUrlForNext` e `inviteCallbackUrl` (`src/shared/lib/auth-callback-url.ts`) la usaban como base — generaban URLs de callback `app.place.community/auth/callback?next=...` y `app.place.community/auth/invite-callback?token_hash=...&next=...` y las embebían en el email del invite y en el `redirectTo` de `signInWithOtp`.

Cuando Supabase verify redirige al callback, el handler corre en host `inbox`. El handler hace `NextResponse.redirect(redirectTarget)` donde `redirectTarget = resolveSafeNext(rawNext, buildInboxUrl())` — URL absoluta con host inbox (porque el fallback es `inboxUrl('/')`). El siguiente request del browser viaja por middleware caso `inbox` (`src/middleware.ts:116-120`):

```ts
case 'inbox': {
  const rest = url.pathname === '/' ? '' : url.pathname
  url.pathname = `/inbox${rest}`
  return copyCookies(NextResponse.rewrite(url, init))
}
```

Que **reescribe** `/foo` → `/inbox/foo`. Combinaciones que rompían:

- `next=/invite/accept/<tok>` → `app.place.community/invite/accept/<tok>` → rewrite a `/inbox/invite/accept/<tok>` → **no existe** (la accept page real vive en `/app/invite/accept/[token]/page.tsx`, fuera de `/app/inbox/`) → 404 global de Next.
- `next=/inbox` (literal) → `app.place.community/inbox` → rewrite a `/inbox/inbox` → no existe → 404.

En dev nadie lo notaba: `NEXT_PUBLIC_APP_URL=http://lvh.me:3000` apunta al apex (caso `marketing` = passthrough sin rewrite).

Independiente de eso, el patrón existente de los callbacks usaba `createServerClient` de `@supabase/ssr` con `setAll` que escribía a `response.cookies.set`. Inspección de `node_modules/@supabase/ssr/src/cookies.ts:301-307,364-379` reveló que `applyServerStorage` (que invoca `setAll`) corre desde el callback async de `onAuthStateChange` — propenso a race en route handlers que retornan response sincrónicamente tras el await del `verifyOtp`/`exchangeCodeForSession`. Y users con sesiones residuales pre-fix podían tener cookies con `Domain=app.place.community` que coexistían con las nuevas `Domain=place.community` y rompían `getUser()`.

## Alternativas consideradas

### A. Cambiar `NEXT_PUBLIC_APP_URL` env var a apex en Vercel

Cambio puntual en Vercel (1 env var) que automáticamente moviría la URL de los callbacks al apex. **Descartada** por blast radius: el env var lo consumen otros code paths (`logout`, validación de same-origin, links absolutos en emails distintos al invite). Hacer un cambio de env var sin auditoría completa de consumers introduce riesgo difuso. Mejor encapsular el invariante "callbacks viven en apex" en helpers explícitos.

### B. Mover los callbacks a un slice `features/auth/`

Encapsular toda la lógica de auth como slice vertical. Arquitectónicamente puro (CLAUDE.md prefiere slices). **Descartada por scope creep**: los callbacks son route handlers thin que ya delegan a `shared/lib/`. Un slice `features/auth/` requiere reformar también `dev-actions.ts`, `requestMagicLink`, los helpers, y romper el patrón "auth es infra compartida" que el repo siguió desde el inicio. Mantener route handlers thin + helpers en `shared/lib/` es consistente con la convención existente y respeta el LOC budget.

### C. Construir URLs con apex via helper centralizado + host-aware redirect post-callback (elegida)

Dos componentes:

1. **Los helpers `authCallbackUrlForNext` e `inviteCallbackUrl` siempre construyen URL del callback con `apexUrl()`** (de `src/shared/lib/app-url.ts:78-81`), no con `clientEnv.NEXT_PUBLIC_APP_URL`. El callback corre en apex independientemente del subdomain donde el user inició el flow.

2. **Nuevo helper `resolveNextRedirect(rawNext)`** (`src/shared/lib/next-redirect.ts`) que mapea el `next` (path relativo o URL absoluta) a URL absoluta con el host correcto:
   - `/invite/accept/<tok>`, `/login`, `/auth/callback`, `/auth/invite-callback` → `apexUrl(path)` (paths globales)
   - `/inbox` → `inboxUrl('/')` (root del subdomain — evita rewrite `/inbox/inbox`)
   - `/inbox/<sub>` → `inboxUrl('/' + sub)` (sin doblar prefijo)
   - `/<slug>/(conversations|library|events|m/<id>|settings)(/...)?` → `placeUrl(slug, rest)`
   - URL absoluta same-origin (apex o `*.<apex>`) → tal cual
   - Cualquier otro → fallback al inbox subdomain root con warn

   Reusa `SAFE_NEXT_PATTERNS` de `src/app/auth/callback/helpers.ts` como fuente de verdad de paths permitidos (ahora exportado).

Adicional: los callbacks pasan a usar `createSupabaseServer()` (existing helper que usa `cookies()` de next/headers — patrón canónico Next 15 + Supabase SSR; mismo patrón que `dev-actions.ts:48` ya validado). Las cookies setteadas por el adapter de `createSupabaseServer` se aplican al response final automáticamente, sin race.

Y un cleanup defensivo: `cleanupLegacyCookies(req, response)` (`src/shared/lib/supabase/cookie-cleanup.ts`) al inicio de cada callback emite `Set-Cookie` con `Max-Age=0` para cookies `sb-*-auth-token` (incluye chunked) en domains alternativos (`Domain=app.<apex>`, host-only). Cubre users con sesiones residuales pre-2026-05-10.

## Decisión

Adoptamos la opción C. Los callbacks viven en apex (vía `apexUrl()` en los helpers), el redirect post-callback es host-aware (vía `resolveNextRedirect`), las cookies se manejan con el patrón canónico de Next 15 (vía `createSupabaseServer()`), y limpiamos sesiones residuales legacy con `cleanupLegacyCookies`.

## Trade-offs

- **Cookie cleanup defensivo invalida sesiones residuales una vez**: users con cookie `Domain=app.place.community` reciben un `Set-Cookie; Max-Age=0` la próxima vez que pasen por un callback. La cookie nueva con `Domain=place.community` se setea inmediatamente después. Para users autenticados en una pestaña activa pre-deploy: pueden ver un logout silencioso si su token expira y el refresh path pasa por callback. Aceptable en pre-lanzamiento.
- **URL del callback en email no es "linda" del subdomain**: la URL ahora dice `place.community/auth/invite-callback?...` en vez de `app.place.community/...`. Transparente para el user (nunca interactúa con la URL del callback directamente; el browser sigue el redirect).
- **`NEXT_PUBLIC_APP_URL` env var queda con valor "subdomain" en Vercel**: posible confusión futura. Mitigado con docstrings explícitos en los helpers nuevos. Auditoría completa de consumers + eventual cambio del env var queda como follow-up post-validación de S2.
- **Helper `resolveNextRedirect` y middleware tienen lógica acoplada de host routing**: si se introduce un nuevo subdomain o se cambia el rewrite del middleware, hay que actualizar el helper en sync. Tests unit del helper dan red de seguridad ante drift.

## Implementación

Ejecutada en 3 sesiones independientes:

- **S1** (commit `7189f80`): `auth-callback-url.ts` apex-ize + nuevo `next-redirect.ts` + tests. Cero impacto runtime.
- **S2** (commit `8b9a2ba`): refactor de `/auth/callback` y `/auth/invite-callback` (createSupabaseServer + resolveNextRedirect + cleanupLegacyCookies) + nuevo `cookie-cleanup.ts` + tests + cleanup `DEBUG TEMPORAL` de instrumentación previa.
- **S3** (este commit): ADR + actualización de gotcha + entries del pre-launch checklist.

Total: 14 archivos tocados, 1953 tests verde, LOC max archivo 245 (cap 300).

## Verificación post-deploy

1. Admin envía invite desde `/settings/access` → user click email → llega a `/invite/accept/<tok>` autenticado (sin pasar por `/login`).
2. User pide magic link desde `/login` → click email → llega al destino correcto (`/inbox` o el path original que disparó el gate) autenticado.
3. Logs Supabase auth (`mcp__supabase-place__get_logs auth`) muestran `Login` event + `auth.sessions` row created.
4. Logs Vercel runtime: `invite_callback_success` o `callback_success` (level info), seguido del request al destino con sesión válida.

## Aplicabilidad a flows futuros

Cualquier nuevo Route Handler que setee sesión Supabase debe:

1. Vivir en apex (vía `apexUrl()` en cualquier helper que construya su URL).
2. Sumarse a `AUTH_PATHS` de `src/middleware.ts:12` (sino el gate redirige a `/login` antes del handler).
3. Usar `createSupabaseServer()` para el client (no `createServerClient` directo).
4. Llamar `cleanupLegacyCookies(req, response)` al inicio para defensa contra cookies residuales.
5. Usar `resolveNextRedirect(rawNext)` para construir el `redirectTarget` post-success.

Cualquier nuevo path destino post-login debe sumarse a `SAFE_NEXT_PATTERNS` (`src/app/auth/callback/helpers.ts:22-33`) — fuente única de verdad de paths permitidos, consumida por `resolveNextRedirect`.
