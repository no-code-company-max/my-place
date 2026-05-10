# Plan — Hardening del cleanup defensivo a production-grade

## Context

**Estado actual** (commit `6ed1a4c`):

- Cleanup defensivo reactivo en `middleware.ts` catch path stale.
- Funcional para el caso reproducido pero con 8 gaps documentados:
  1. Reactivo, no proactivo (user ve UN redirect a /login la primera vez)
  2. Sin tests
  3. Borra demasiado (loop sin filtro de currentProjectRef)
  4. No discrimina causas stale (cleanup uniforme para todos los error codes)
  5. No previene root cause histórico (cookies host-only emitidas por código)
  6. Sin metrics ni log estructurado discriminable
  7. Sin ADR documentando bug + fix + tradeoffs
  8. Cleanup limpia solo host actual (multi-subdomain requiere visit individual)

**Outcome:** 4 sesiones acotadas que cierran los 8 gaps sin reescribir el approach base.
Mantienen el invariante actual (1965 tests pasan, flow funciona) y agregan layers de robustez.
Cada sesión independiente, deployable sola.

**Decisiones del user (2026-05-10):**

- Ejecutar las 4 sesiones (production-grade total).
- Metrics via Vercel Logs estructurado (no PostHog/DataDog).

---

## Sesión 1 — Hardening del cleanup actual + ADR

**Goal:** los 3 gaps más críticos para llegar a production-grade básico:

- Cleanup borra demasiado (filtrar por currentProjectRef).
- Sin tests.
- Sin ADR.

**Files:**

- `src/shared/lib/supabase/middleware.ts` — cambiar el regex del cleanup loop por
  `^sb-${currentRef}-auth-token(\.\d+)?$` (extraer `currentRef` de NEXT_PUBLIC_SUPABASE_URL).
  LOC delta: +3 / -1.

- **NEW** `src/shared/lib/supabase/__tests__/middleware-stale-cleanup.test.ts` (~150 LOC):
  - Test 1: getSession lanza `refresh_token_not_found` → response tiene Set-Cookie maxAge=0
    para `sb-{currentRef}-auth-token` y chunks `.0`/`.1`.
  - Test 2: getSession OK (con user) → NO emite cleanup.
  - Test 3: cleanup NO afecta cookies de OTROS project refs (`sb-pdifweaajellxzdpbaht-...`).
  - Test 4: cleanup NO afecta cookies no-supabase (`session=...`, `_ga=...`).
  - Test 5: cleanup emite Set-Cookie con `Path=/`, `Max-Age=0`, `Secure`, `SameSite=Lax`,
    **sin** `Domain` (host-only).
  - Test 6: cleanup loggea `MW_stale_cleanup` con `host` y `path`.

- **NEW** `docs/decisions/2026-05-10-cookie-residual-host-only-cleanup.md` (~150 LOC):
  - Contexto: bug reproducible + diagnóstico vía `/api/debug-getsession`.
  - Decisión: cleanup host-only filtrado por currentProjectRef.
  - Alternativas: proactivo (Sesión 3), boundary test (Sesión 2), borrar todo sin filtro.
  - Tradeoffs aceptados: reactivo, multi-subdomain self-heals individualmente,
    discriminación de error codes en Sesión 4.

**Verificación:** vitest del archivo nuevo verde + suite completa verde + typecheck.

**LOC delta:** +303 net.

**Riesgo deploy:** bajo (regex additive + tests).

---

## Sesión 2 — Prevention: bloquear emisión de cookies host-only desde código

**Goal:** cerrar la causa raíz. Garantizar que ningún path emite cookies `sb-*` sin `Domain`
attribute. Si alguien introduce un bug futuro, el test guard lo bloquea.

**Files:**

- `tests/boundaries.test.ts` — agregar test "cookies sb-_ siempre con Domain explícito":
  grep en `src/\*\*/_.ts`por patterns de Set-Cookie sb-\_ sin domain.
  Lista de excepciones documentada (cleanup defensivo intencional).
  LOC delta: +60.

- `docs/architecture.md` § "Cookies de sesión Supabase (Domain)" — regla:
  TODA Set-Cookie de `sb-_` DEBE tener `Domain=<apex>` explícito vía `cookieDomain()`.
  Excepción única: cleanup defensivo `Max-Age=0`. LOC delta: +30.

- **Audit manual** del codebase (resultados en commit message, no archivo separado):
  - `grep -rn "sb-\|auth-token" src/ | grep -i "cookie\|set-cookie"`
  - Verificar cada call site
  - Si encontramos paths problemáticos, fix + test antes de continuar

**Verificación:** boundaries test verde, audit reportado, suite completa verde.

**LOC delta:** +90 (sin contar fixes si emergen del audit).

**Riesgo deploy:** bajo (test guard + doc).

---

## Sesión 3 — Cleanup proactivo (mejora primera impresión)

**Goal:** cubrir el gap "es reactivo, user ve /login la primera vez".

**Approach (opción C de las evaluadas):** middleware detecta cookies duplicadas en el
header raw (host-only + apex coexistiendo) ANTES de llamar getSession. Si detecta duplicados,
emite cleanup host-only ANTES del SDK call → el SDK lee la apex (correcta) en próximo request.

**Files:**

- `src/shared/lib/supabase/middleware.ts` — helper `detectAndCleanHostOnlyResidual`:
  - Parsear `req.headers.get('cookie')` raw (no `req.cookies.getAll()` que deduplica)
  - Si hay 2+ entries con name `sb-{currentRef}-auth-token`, emitir Set-Cookie maxAge=0
  - LOC delta: ~+50.

- Tests:
  - Header con cookie duplicada → middleware emite cleanup proactivo
  - Header con cookie única → no emite cleanup proactivo
  - LOC delta: ~+80.

**Verificación:** tests específicos pasan, smoke test prod, suite completa verde.

**LOC delta:** +130.

**Riesgo deploy:** medio (parsing de cookie header raw tiene long tail de edge cases).

---

## Sesión 4 — Observability + discriminación fina

**Goal:** los 2 gaps restantes (sin metrics, no discrimina causas stale).

**Files:**

- `src/shared/lib/supabase/middleware.ts` — refactorizar `MW_stale_cleanup`:
  - Sumar campo `errCode` (`refresh_token_not_found` / `refresh_token_already_used` /
    `session_not_found` / `session_expired`)
  - Sumar campo `cookiesCleared` (count + names)
  - Discriminar:
    - `refresh_token_already_used` (race entre tabs) → NO cleanup, solo signOut local
    - `session_not_found` / `session_expired` → cleanup OK (logout remoto, debe reloguear)
    - `refresh_token_not_found` → cleanup host-only (caso típico)
  - LOC delta: ~+30.

- Tests del discriminator (4 tests, uno por error code):
  LOC delta: ~+80.

- **Metrics:** logger structured con campos parseables. Vercel Logs queryable por errCode.
  Sin instrumentación de PostHog/DataDog (decisión user 2026-05-10).

- **Multi-subdomain coverage:**
  - **NEW** `docs/gotchas/cookie-residual-multi-subdomain.md` (~40 LOC)
  - Documentar: si user tiene cookies residuales en N subdominios, cada uno self-heals individualmente
  - Workaround para testers: limpiar cookies de `*.place.community`

**Verificación:** tests del discriminator pasan, logs estructurados queryable, gotcha documentado.

**LOC delta:** +150.

**Riesgo deploy:** bajo.

---

## Resumen total

| Sesión                              | LOC delta | Riesgo | Tiempo est. |
| ----------------------------------- | --------- | ------ | ----------- |
| 1 — Hardening + ADR                 | +303      | Bajo   | 1.5h        |
| 2 — Prevention + audit              | +90       | Bajo   | 1h          |
| 3 — Cleanup proactivo               | +130      | Medio  | 1.5h        |
| 4 — Observability + multi-subdomain | +150      | Bajo   | 1h          |
| **Total**                           | **+673**  | —      | **~5h**     |

**Cumplimiento CLAUDE.md / architecture.md:**

- ✅ TDD: tests primero en cada sesión.
- ✅ LOC: archivo más grande post-cambios `middleware.ts` ~250 LOC (cap 300).
- ✅ Funciones: helpers nuevos quedan <60 LOC.
- ✅ Vertical slices: cambios en `shared/lib/supabase/` (módulo compartido), `tests/boundaries.test.ts`, `docs/`.
- ✅ Sesiones cortas y focalizadas: 4 sesiones independientes, deployables solas.
- ✅ Idioma: comentarios en español, código en inglés.
- ✅ Production-grade: zero quick fixes, zero parches.

**Reglas de trabajo agente:**

- Sin sub-agentes para este plan (todo en thread directo).
- Commit local antes de empezar cada sesión.
- Tests verdes antes de push.
- No revertir cambios anteriores.
