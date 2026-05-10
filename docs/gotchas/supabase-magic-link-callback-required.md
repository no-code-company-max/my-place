# Magic links de Supabase Admin requieren `/auth/callback` para setear sesión

`supabase.auth.admin.generateLink({ type: 'invite' | 'magiclink', options: { redirectTo } })` retorna un `action_link` que al clickearse hace token verify y redirige a `redirect_to` con `?code=<jwt>` query param.

**Para que esa sesión se materialice como cookie en el browser hay que llamar `exchangeCodeForSession(code)` server-side**. En este repo, eso lo hace `src/app/auth/callback/route.ts` (Route Handler que setea cookies con `domain=<apex>` para cross-subdomain).

## Síntoma del bug

Si `redirectTo` apunta directo al destino final (ej: `/invite/accept/{token}`), la página llega sin sesión:

1. User clickea link del email → Supabase verify → redirige a `/invite/accept/{token}?code=<jwt>`.
2. Page hace `supabase.auth.getUser()` → retorna `null` (cookies no seteadas).
3. Page redirige a `/login?next=/invite/accept/{token}`.
4. User tiene que tipear su email para recibir un SEGUNDO magic link.
5. Friction inaceptable + UX rota del onboarding.

Reportado en producción 2026-05-09 (commit del fix: feat(members): invitation flow magic link friction).

## Fix canónico

Pasar SIEMPRE por `/auth/callback?next=...` cuando se construye `redirectTo` para magic links. Helper centralizado:

```ts
// src/shared/lib/auth-callback-url.ts
import { authCallbackUrlForNext } from '@/shared/lib/auth-callback-url'

await generateInviteMagicLink({
  email,
  redirectTo: authCallbackUrlForNext(`/invite/accept/${token}`),
})
```

Flow correcto:

1. User clickea link → Supabase verify → redirige a `/auth/callback?code=<jwt>&next=/invite/accept/{token}`.
2. `/auth/callback` hace `exchangeCodeForSession(code)` → cookies seteadas con `domain=<apex>`.
3. Callback redirige a `next` validado (debe estar en `SAFE_NEXT_PATTERNS` de `auth/callback/helpers.ts`).
4. Page final `/invite/accept/{token}` → user con sesión → renderiza happy path.

## Side effect requerido: actualizar `SAFE_NEXT_PATTERNS`

El callback enforce una allowlist de paths para `next` (defensa contra open-redirect + paths 404). Cuando se introduce un nuevo path destino para magic links, **hay que sumarlo** a `SAFE_NEXT_PATTERNS` en `src/app/auth/callback/helpers.ts`. Sino el callback redirige al fallback (inbox) por security guard.

Patrón actual incluye `/invite/accept/<token>` con regex `[A-Za-z0-9_-]+` (token base64url-safe). Si se suman flows de magic link a otros paths (password reset, email change, etc.), agregar pattern correspondiente + test en `helpers.test.ts`.

## Backward compat

Invitations enviadas ANTES del fix tienen el `redirectTo` viejo (sin `/auth/callback`). El usuario que las clickea va a caer en `/login` igual. Workarounds:

- Admin clickea "Reenviar invitación" en `/settings/access` → genera nuevo link con el redirectTo correcto.
- Si la invitación está cerca de expirar, simplemente esperar a que expire y reinvitar.

No hay fix automático para los emails ya en inbox del usuario (no podemos editar emails enviados).

## Tests que cubren el fix

- `src/shared/lib/__tests__/auth-callback-url.test.ts` — unit del helper.
- `src/app/auth/callback/helpers.test.ts` — `SAFE_NEXT_PATTERNS` acepta `/invite/accept/<token>` y rechaza variantes inválidas.
- `src/features/members/{__tests__,invitations/__tests__}/invite-member.test.ts` — assert que `redirectTo` pasa por `/auth/callback`.
- `src/features/members/{__tests__,invitations/__tests__}/resend-invitation.test.ts` — idem.

## Aplicabilidad a futuros flows

Cualquier server action que llame `supabase.auth.admin.generateLink()` con `redirectTo` debe usar el helper `authCallbackUrlForNext()`. Si construye URL a mano, el bug regresa silencioso (los tests del propio action no detectan el problema porque el flow real corre en el browser).

Convención: NO importar `clientEnv.NEXT_PUBLIC_APP_URL` directo para construir URLs de magic link redirect. Siempre via helper.
