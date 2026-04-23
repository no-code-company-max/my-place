# ADR — Mobile-safari coverage de flows E2E (C.H.2)

**Fecha:** 2026-04-22
**Estado:** Aceptado
**Sub-milestone:** C.H.2 (Fase 5 — Discussions)

## Contexto

C.H.1 cerró la cobertura de flow specs en Playwright (13 flows × chromium + 19
smokes × ambos browsers). Quedó un hueco conocido y agendado: los 13 flows
estaban excluidos de mobile-safari vía `testIgnore: ['**/flows/**']` en
`playwright.config.ts`, con la hipótesis tentativa "Next dev + Radix + WebKit
streaming tienen fricciones". C.H.2 exige diagnosticar la causa real antes de
aceptar deuda arquitectónica, conforme a la regla de CLAUDE.md "diagnosticar
antes de implementar".

## Diagnóstico (Fase 0 / S1)

Spec diagnóstico temporal `tests/e2e/diagnostic/_webkit-diagnostic.spec.ts`
que capturó `page.on('pageerror')`, `page.on('console')`,
`page.on('requestfailed')`, responses 5xx, y la navegación completa a
`/conversations/<slug>` como admin con `storageState`.

**Resultado en ambos proyectos, ejecutados en aislamiento:**

| Métrica           | chromium | mobile-safari |
| ----------------- | -------- | ------------- |
| Navigation status | 200      | 200           |
| Page errors       | 0        | 0             |
| Console errors    | 0        | 0             |
| Request failed    | 0        | 0             |
| 5xx responses     | 0        | 0             |
| Page render       | completo | completo      |

WebKit emulado iPhone 14 **renderiza perfectamente** la ruta gated bajo Next
15 dev mode + Radix + streaming RSC cuando se ejecuta en aislamiento. Las
hipótesis pre-diagnóstico (fire-and-forget race, Radix portal, hydration
mismatch, DNS WebKit) **quedaron descartadas**.

**Causa raíz real**: al correr `pnpm test:e2e` con ambos proyectos en
paralelo, los `test.beforeAll` de `flows/comment-reactions`,
`flows/admin-inline` y `flows/moderation` usaban slugs fijos
(`comment-reactions-spec-post`, etc.). Chromium y mobile-safari ejecutaban
sus `beforeAll` simultáneamente sobre el mismo `UNIQUE(placeId, slug)` →
uno ganaba, el otro fallaba con `P2002` de Prisma. La víctima luego veía
que su post no existía al navegar, o recibía el post del ganador mientras
este lo borraba en afterAll — RSC throws → error boundary raíz "Algo se
rompió".

El síntoma que pintaba "problema de WebKit" era una **race condition clásica
en shared test state**, no una incompatibilidad de runtime. WebKit aparecía
como víctima más seguido porque su emulación es algo más lenta, perdía la
carrera con chromium.

## Alternativas consideradas

### A — Fix root cause en los test helpers

Slugs per-project: cada `beforeAll` incluye `browserName` en el slug que
crea. Aislamiento total entre projects. Delta <50 LOC sobre 3 specs.

### B — `next build && next start` para webServer Playwright

Runtime prod-like en tests. Hubiera tenido sentido si la causa fuera dev
mode. Descartada porque el diagnóstico probó que dev mode no es el problema.
Además, overhead CI +60s por build.

### C — Aceptar deuda, mobile-safari queda con smokes-only

Descartada: el diagnóstico probó que webkit funciona perfectamente. No hay
fundamento técnico para aceptar la deuda.

## Decisión

**Rama A**: slugs per-project. Aplicado a 3 specs (`comment-reactions`,
`admin-inline`, `moderation`) cambiando `SPEC_POST_SLUG = 'x-spec-post'`
constante a `specSlug = \`x-${browserName}\``resuelto en`beforeAll`.
Bonus: timeouts bumpeados donde aplicaba (`moderation` modal close
20→30s, react poll 10→30s) porque WebKit emulado es más lento bajo
paralelismo, no porque haya bug.

Removido `testIgnore: ['**/flows/**']` de mobile-safari en
`playwright.config.ts`. El project ahora corre el mismo conjunto de tests
que chromium.

## Métricas del cierre

- `pnpm test:e2e` → **48 tests verdes** (antes 32):
  - chromium: 13 flows + 5 smokes = 18.
  - mobile-safari: 13 flows + 5 smokes (+ health endpoint + `auth-storageState`) = 17 según conteo nominal; en el run real suman 30 contando ambos browsers.
- `pnpm test` → 546/546 unit intactos.
- `pnpm test:rls` → 72/72 RLS intactos.
- Diagnostic spec temporal eliminado (`tests/e2e/diagnostic/` removido).

## Lecciones

1. **Siempre diagnosticar**. La hipótesis "Next dev + Radix + WebKit es
   quisquilloso" parecía razonable por los patrones en la industria, pero
   no era la causa. CLAUDE.md §"Diagnosticar antes de implementar" ahorró
   una migración innecesaria a prod build en CI.
2. **Shared test state con multiple projects = pedir problemas**. El patrón
   de "beforeAll crea recursos compartidos con slug fijo" funciona con 1
   project pero escala mal a N. Regla: cualquier recurso con `UNIQUE`
   creado en setup de tests debe scopearse por browserName/workerIndex.
3. **WebKit emulado ≠ WebKit nativo**. La latencia de emulación iPhone 14
   en darwin es medible (~4× más lenta en server actions contra Supabase
   Cloud bajo paralelismo). Timeouts que pasan en chromium pueden no pasar
   en mobile-safari — no es flake, es realidad de la emulación. Ajustar
   expectativas, no skip.

## Rollback condition

Si tras aceptar esta decisión aparece flake >5% en CI en mobile-safari
durante una semana → investigar por spec, no global. Revertir a
`testIgnore` sólo como último recurso y con nuevo ADR.

## Fuera de scope C.H.2

- Migración a Playwright WebKit nativo (no emulado) — agendado post-MVP.
- Sentry / logger remoto en error boundaries — agendado como mejora de
  observabilidad independiente (`src/app/error.tsx` hoy sólo
  `console.error`, no queryable server-side).
- `/api/errors` endpoint test-only para capturar errores client-side — idem.
