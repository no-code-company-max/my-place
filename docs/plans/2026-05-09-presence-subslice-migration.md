# Plan — Migración del sub-slice `discussions/presence/`

**Fecha:** 2026-05-09
**Estado:** Pendiente de aprobación
**Owner:** Maxi
**Origen:** Item out-of-scope del fix de presence (commit `1bba053`). Sub-slice `presence/` quedó parcialmente cableado desde refactors previos; el bug de presence forzó duplicar `thread-presence.tsx` en ambas copias defensivamente. Esta migración cierra la deuda.

---

## 0. Estado verificado (auditoría 2026-05-09)

### 0.1 Inventario presence en `discussions/`

**Sub-slice nuevo `discussions/presence/`** — existe, parcialmente cableado:

| Archivo                                   | LOC | Cableo                                                                                                                                                                                                       |
| ----------------------------------------- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `presence/public.ts`                      | 16  | exporta `DwellTracker`, `PostReadersBlock`, `PostUnreadDot`, `ReaderStack`, `ThreadPresence`, `markPostReadAction`                                                                                           |
| `presence/public.server.ts`               | 19  | exporta `findOrCreateCurrentOpening`, `fetchCommentCountByPostId`, `fetchLastReadByPostId`, `fetchReadersSampleByPostId`, `listReadersByPost`, `PostReader`                                                  |
| `presence/server/place-opening.ts`        | 119 | **idéntico byte-a-byte** a `discussions/server/place-opening.ts`                                                                                                                                             |
| `presence/server/queries/post-readers.ts` | 176 | superset funcional: agrupa `listReadersByPost` + 3 helpers privatizados en legacy + tipo `PostReader` exportable; difiere de legacy en que esos 3 helpers son `export` (legacy son `function` no exportadas) |
| `presence/server/actions/reads.ts`        | 101 | difiere del legacy SOLO en una línea: `import { resolveActorForPlace } from '@/features/discussions/server/actor'` (legacy usa `'../actor'`). Lógica idéntica.                                               |
| `presence/ui/dwell-tracker.tsx`           | 109 | difiere SOLO en `import { DWELL_THRESHOLD_MS } from '@/features/discussions/domain/invariants'` (legacy `'../domain/invariants'`)                                                                            |
| `presence/ui/post-readers-block.tsx`      | 45  | difiere SOLO en `import type { PostReader } from '@/features/discussions/presence/server/queries/post-readers'` (legacy `'../server/queries'`)                                                               |
| `presence/ui/post-unread-dot.tsx`         | 32  | byte-a-byte idéntico a legacy                                                                                                                                                                                |
| `presence/ui/reader-stack.tsx`            | 72  | difiere SOLO en `import type { ReaderForStack } from '@/features/discussions/domain/types'` (legacy `'../domain/types'`)                                                                                     |
| `presence/ui/thread-presence.tsx`         | 133 | difiere del legacy en 2 comentarios (referencia cruzada al otro archivo). Lógica byte-a-byte idéntica incluyendo el fix `post:<id>:presence` del commit `1bba053`                                            |

**Total sub-slice:** 795 LOC prod (`scripts/lint/check-slice-size.ts`).

**Tests sub-slice (`presence/__tests__/`)** — 6 archivos, todos clones del legacy con un import cambiado:

| Test sub-slice                 | vs. legacy `discussions/__tests__/`                                                                                                                 |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dwell-tracker.test.tsx`       | byte-a-byte idéntico                                                                                                                                |
| `place-opening.test.ts`        | byte-a-byte idéntico                                                                                                                                |
| `list-readers-by-post.test.ts` | difiere en 1 línea (`from '@/features/discussions/presence/server/queries/post-readers'` vs `'../server/queries'`)                                  |
| `post-readers-block.test.tsx`  | difiere en 1 línea (import del componente migrado al sub-slice)                                                                                     |
| `reader-stack.test.tsx`        | difiere en 1 línea (import del componente migrado al sub-slice)                                                                                     |
| `post-event-relation.test.ts`  | difiere en 1 línea — pero apunta a `posts/public.server` (NO a presence). **Test mal ubicado**; debería vivir en `posts/__tests__/`. Flag F1 abajo. |

**Legacy presence en `discussions/ui/`** — TODAVÍA wireado por `discussions/public.ts`:

| Archivo legacy                         | Wireado por                                                                                                                                                                         | Sigue ahí porque                     |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `ui/thread-presence.tsx` (132 LOC)     | `public.ts:131` re-exporta vía `thread-presence-lazy.tsx`                                                                                                                           | Es la copia que entra al runtime hoy |
| `ui/thread-presence-lazy.tsx` (70 LOC) | `public.ts:131` `ThreadPresenceLazy as ThreadPresence`                                                                                                                              | Wrapper `React.lazy` post-FCP        |
| `ui/dwell-tracker.tsx` (108 LOC)       | `public.ts:120`                                                                                                                                                                     | Cableo principal                     |
| `ui/post-readers-block.tsx` (45 LOC)   | `public.server.ts:73`                                                                                                                                                               | Cableo principal                     |
| `ui/post-unread-dot.tsx` (32 LOC)      | `public.ts:121`                                                                                                                                                                     | Cableo principal                     |
| `ui/reader-stack.tsx` (72 LOC)         | NINGÚN consumer `@/features/discussions/...` lo usa hoy. Solo `featured-thread-card.tsx` y `thread-row.tsx` legacy (no wireados por `public.ts`) lo importan. **Es código muerto**. |

**Legacy presence en `discussions/server/`** — TODAVÍA wireado por `public.server.ts`:

| Archivo legacy                               | Wireado                                                               |
| -------------------------------------------- | --------------------------------------------------------------------- |
| `server/place-opening.ts` (119 LOC)          | `public.server.ts:65` `findOrCreateCurrentOpening`                    |
| `server/queries.ts` (545 LOC, multi-dominio) | `public.server.ts:39-50` `listReadersByPost` + Posts/Comments queries |
| `server/actions/reads.ts` (101 LOC)          | `public.ts:103` `markPostReadAction`                                  |

**Legacy tests duplicados:**

- `discussions/__tests__/dwell-tracker.test.tsx`
- `discussions/__tests__/place-opening.test.ts`
- `discussions/__tests__/post-readers-block.test.tsx`
- `discussions/__tests__/reader-stack.test.tsx`
- `discussions/__tests__/list-readers-by-post.test.ts`
- `discussions/__tests__/reactions-reads.test.ts` (mixto: `reactAction` + `markPostReadAction`)

### 0.2 Consumidores externos al slice

| Caller                                                                | Importa                                                           | De                          |
| --------------------------------------------------------------------- | ----------------------------------------------------------------- | --------------------------- |
| `(gated)/conversations/[postSlug]/_thread-content.tsx`                | `DwellTracker, ThreadPresence`                                    | `discussions/public`        |
| `(gated)/conversations/[postSlug]/_comments-section.tsx`              | `PostReadersBlock, findOrCreateCurrentOpening, listReadersByPost` | `discussions/public.server` |
| `(gated)/library/[categorySlug]/[itemSlug]/_library-item-content.tsx` | `DwellTracker, ThreadPresence`                                    | `discussions/public`        |
| `(gated)/library/[categorySlug]/[itemSlug]/_comments-section.tsx`     | `PostReadersBlock, findOrCreateCurrentOpening, listReadersByPost` | `discussions/public.server` |
| `(gated)/layout.tsx`                                                  | `findOrCreateCurrentOpening`                                      | `discussions/public.server` |

(5 callers externos. Otros internos al slice — `threads/`, `reactions/`, `posts/` — ya migraron al sub-slice.)

### 0.3 LOC del slice raíz

```
discussions (raíz, descontando sub-slices)  6811 LOC  (cap 1500 — viola)
discussions/presence                          795 LOC  (cap 1500 — OK)
```

**Estimado de bajada del raíz post-migración:** entre -260 y -679 LOC. **Esta migración no cierra la excepción de tamaño** (el raíz queda en ~6132-6551). Posts/Comments cleanup de `server/queries.ts` queda como deuda separada.

### 0.4 Flags abiertos (decisión del owner)

- **F1.** `presence/__tests__/post-event-relation.test.ts` testea `findPostById/findPostBySlug` de `posts/public.server` — está geográficamente mal ubicado. **Decisión:** mover en sesión follow-up con scope Posts. NO en este plan.
- **F2.** `presence/server/queries/post-readers.ts` exporta 3 helpers privados que solo `posts/server/queries/posts.ts` consume cross-sub-slice. Decisión sobre desacoplar (DI vs export directo) queda para `posts/`.
- **F3.** Bundle size del lazy `thread-presence` puede romperse si webpack reorganiza chunks — verificar con `ANALYZE=true pnpm build` antes/después de A.2.
- **F4.** Mientras la migración no se cierre (A→B), cualquier sesión que toque presence debe actualizar AMBAS copias (legacy + sub-slice). Riesgo activo de drift.

---

## 1. Objetivo

**Sustantivo:** los Server/Client Components y la action de presence viven solo en `discussions/presence/`. La API pública del slice (`discussions/public.ts` + `discussions/public.server.ts`) re-exporta desde el sub-slice (no se rompe el contrato externo).

**Adjetivos no negociables:** zero downtime, tests verdes en cada commit, equivalente bundle (chunk lazy preservado), reversible commit-a-commit.

**Fuera de scope:**

- Migración del legacy `server/queries.ts` que cubre Posts/Comments.
- Cleanup de los archivos `discussions/ui/*-thread*`/`*comment*`/`*composer*` ya duplicados.
- Fix de la race secundaria de `viewer.displayName` en `useEffect` de ThreadPresence.
- Cleanup de logs `DEBUG TEMPORAL` (en `docs/pre-launch-checklist.md`).

---

## 2. Estrategia (resumen)

3 fases / 5 sub-fases / cada una commit autosuficiente:

- **Fase A — Re-wire (2 sub-fases):** apuntar `discussions/public.ts` y `public.server.ts` a `presence/`. No se borra nada. No-op semántico (ambas copias son idénticas).
- **Fase B — Eliminación legacy (2 sub-fases):** borrar archivos legacy de presence + tests duplicados.
- **Fase C — Docs (1 sub-fase):** actualizar ADRs/gotchas afectados.

Orden por riesgo creciente. Si algo falla, revert solo de la sub-fase actual.

---

## 3. Sub-fases

### A.1 — Re-wire de `discussions/public.server.ts` a `presence/public.server`

**Archivos:** `discussions/public.server.ts`, `discussions/server/queries.ts` (eliminar exports presence-related).

**Verificación:** `pnpm typecheck && pnpm lint && pnpm vitest run && pnpm test --run tests/boundaries.test.ts`.

**Rollback:** revert.

### A.2 — Re-wire de `discussions/public.ts` + preservar lazy chunk

**Decisión a tomar:**

- **Opción 1 (cohesión completa):** mover `thread-presence-lazy.tsx` al sub-slice. Cambia shape de `presence/public.ts` (exporta lazy en lugar del real).
- **Opción 2 (mínimo cambio):** dejar `thread-presence-lazy.tsx` en raíz; importar el real desde `presence/public`.

**Recomendación:** Opción 1, validando con `grep` que nadie externo a `presence/` importa el ThreadPresence real desde `presence/public`.

**Verificación:** typecheck + lint + tests + `ANALYZE=true pnpm build` con comparación de chunks vs baseline.

**Smoke manual obligatorio en preview:** abrir thread → verificar Network tab que el chunk presence baja post-FCP, console sin `cannot add presence callbacks`, markPostReadAction dispara tras 5s. Repetir en library.

### B.1 — Borrar legacy server/ + tests legacy server-related

**Borrar:** `discussions/server/place-opening.ts`, `discussions/server/actions/reads.ts`, `__tests__/place-opening.test.ts`, `__tests__/list-readers-by-post.test.ts`, `__tests__/reactions-reads.test.ts` (verificar drift vs sub-slice antes).

**Editar:** `discussions/server/queries.ts` — quitar `listReadersByPost` y `PostReader`. **Cuidado** con los 3 helpers privados que `listPostsByPlace` legacy puede seguir usando — verificar grep antes de borrarlos.

**Verificación:** typecheck + tests + `pnpm tsx scripts/lint/check-slice-size.ts` (debe mostrar bajada de ~220-300 LOC).

### B.2 — Borrar legacy ui/ + tests UI

**Borrar:** `discussions/ui/{dwell-tracker,post-readers-block,post-unread-dot,reader-stack,thread-presence,thread-presence-lazy}.tsx`, `__tests__/{dwell-tracker,post-readers-block,reader-stack}.test.tsx`.

**Verificación crítica antes de borrar `reader-stack.tsx`:** `grep -rn "from './reader-stack'\|from '\\.\\./ui/reader-stack'" src/features/discussions`. Si hay consumers en legacy `featured-thread-card.tsx`/`thread-row.tsx`/`post-list.tsx`, son código muerto wireado por nada — borrar también (cleanup oportunista, mencionar en commit).

**Verificación:** typecheck + tests + `ANALYZE=true pnpm build` (chunks comparables).

### C — Documentación + verificación final

**Tocar:**

- `docs/decisions/2026-04-20-discussions-size-exception.md` — actualizar tabla LOC + nota de pendientes.
- `docs/decisions/2026-05-09-realtime-presence-topic-split.md` § "Consecuencias" — borrar bullets sobre duplicación temporal.
- `docs/gotchas/supabase-channel-topic-collision.md` § "Fix aplicado" — borrar mención al archivo legacy.
- `members/ui/resend-invitation-button.tsx` (línea 18) — actualizar comentario apuntando a la ruta nueva.
- `src/features/discussions/presence/README.md` (nuevo, opcional) — 1 página describiendo el sub-slice.

**No requerido:** ADR nuevo (cubierto por `2026-05-04-library-root-sub-split-and-cap-enforcement.md` + `2026-05-08-sub-slice-cross-public.md`).

---

## 4. Riesgos integrales

| Riesgo                                                                  | Probabilidad                | Impacto | Mitigación                                                                     |
| ----------------------------------------------------------------------- | --------------------------- | ------- | ------------------------------------------------------------------------------ |
| Chunk lazy `thread-presence` se rompe                                   | media                       | alto    | `ANALYZE=true pnpm build` antes/después de A.2; rollback si crece >5 kB        |
| Bug de presence regresiona                                              | baja                        | alto    | Smoke manual en preview tras A.2 + B.2; tests RLS `helpers-realtime.test.ts`   |
| Drift entre copias mientras la migración está en limbo                  | alta (mientras dura A)      | medio   | Cerrar A→B en sesiones consecutivas; máximo 2 semanas de limbo                 |
| `server-only` import escapa al cliente                                  | baja                        | alto    | Test `boundaries.test.ts` enforce; build falla loud                            |
| Borrar helpers privados de `queries.ts` rompe `listPostsByPlace` legacy | media (B.1 si no se valida) | alto    | Verificar con grep antes de borrar; si sigue usado, dejar para migración Posts |
| Tests legacy con cobertura mayor que sub-slice                          | baja                        | medio   | Diff antes de borrar; portar casos faltantes                                   |

---

## 5. Test plan integral (cierre)

```bash
pnpm typecheck
pnpm lint
pnpm vitest run
pnpm test --run tests/boundaries.test.ts tests/rls/helpers-realtime.test.ts tests/rls/post-read.test.ts
ANALYZE=true pnpm build
# CI: pnpm e2e si hay
```

**Verificaciones grep:**

```bash
# Nada externo importa legacy
grep -rn "from '@/features/discussions/ui/dwell-tracker\|from '@/features/discussions/ui/thread-presence\|from '@/features/discussions/ui/post-readers-block\|from '@/features/discussions/ui/post-unread-dot\|from '@/features/discussions/ui/reader-stack\|from '@/features/discussions/server/place-opening\|from '@/features/discussions/server/actions/reads" src tests
# Esperado: 0

# Nada externo a presence importa internals
grep -rn "from '@/features/discussions/presence/ui\|from '@/features/discussions/presence/server\|from '@/features/discussions/presence/__tests__" src tests | grep -v "discussions/presence/"
# Esperado: 0

# LOC bajó
pnpm tsx scripts/lint/check-slice-size.ts
# Esperado: discussions raíz < 6300 LOC (vs 6811 baseline)
```

**Smoke manual en preview deploy:**

1. `/conversations/<post>` con DevTools — sin `cannot add presence callbacks`, dwell tracker dispara markPostReadAction tras 5s, presence chunk no eager.
2. `/library/<cat>/<item>` — idem.
3. Thread abierto en dos tabs — avatares aparecen en cada tab.
4. Cambio a otra tab por 6s y volver — dwell tracker pausa y reanuda.

---

## 6. Cronograma sugerido

- **Sesión 1** (1-2h): A.1 + A.2 (re-wire). Merge a main si verde + smoke OK.
- **Sesión 2** (1-2h): B.1 + B.2 (borrar legacy). Merge.
- **Sesión 3** (30 min): C (docs). Merge.

---

## 7. Plan detallado de B.2 + C (production-grade, post-B.1)

> **Fecha del sub-plan:** 2026-05-09 post-commit `0a718f3`
> **Estado base verificado:** A.1, A.2, B.1 deployados y smoke verificado en prod.
> **Cambio importante vs § 3 de este doc:** los 3 archivos del "cleanup oportunista" (`featured-thread-card.tsx`, `thread-row.tsx`, `post-list.tsx`) **NO son código muerto** — son la única implementación wireada hoy. El sub-slice `discussions/threads/` está cableado en su `public.ts` pero cero consumers externos (huérfano). Su consolidación queda fuera del scope de B.2 → **B.3** (nuevo follow-up).

### 7.1 Auditoría empírica (verificada in-situ)

#### Archivos del scope core de B.2

| Archivo                                             | LOC | Importadores activos                                                  | Diff vs sub-slice                 | Veredicto                           |
| --------------------------------------------------- | --- | --------------------------------------------------------------------- | --------------------------------- | ----------------------------------- |
| `discussions/ui/thread-presence.tsx`                | 132 | 0 (sólo refs textuales en comentarios)                                | 4 líneas de comentarios cross-ref | **BORRABLE LIBRE**                  |
| `discussions/ui/post-readers-block.tsx`             | 45  | 1 (sólo su test legacy)                                               | 1 línea (path import)             | **BORRABLE LIBRE** (con su test)    |
| `discussions/__tests__/post-readers-block.test.tsx` | 96  | n/a                                                                   | 1 línea (path)                    | **BORRABLE**                        |
| `discussions/__tests__/reader-stack.test.tsx`       | 72  | n/a                                                                   | 1 línea (path)                    | **BORRABLE LIBRE**                  |
| `discussions/ui/post-unread-dot.tsx`                | 15  | 2 internos: `featured-thread-card.tsx:6`, `thread-row.tsx:6` (legacy) | byte-idéntico                     | **TIED a B.3 — NO se borra en B.2** |
| `discussions/ui/reader-stack.tsx`                   | 72  | 3 internos (los anteriores + `post-readers-block` legacy)             | imports relativos                 | **TIED a B.3 — NO se borra en B.2** |

Comandos exactos para reproducir auditoría:

```bash
grep -rn "ui/thread-presence['\"]" src tests
grep -rn "ui/post-readers-block['\"]" src tests
grep -rn "ui/post-unread-dot['\"]" src tests
grep -rn "ui/reader-stack['\"]" src tests

diff src/features/discussions/ui/thread-presence.tsx \
     src/features/discussions/presence/ui/thread-presence.tsx
# (idem para los demás)

# Sub-slice threads sin consumers externos (justifica excluir cleanup oportunista)
grep -rn "discussions/threads/public\|features/discussions/threads/" src tests
```

### 7.2 LOC accounting predicho

| Slice/sub-slice        | LOC actual (post-B.1) | LOC post-B.2 | Cap  | Distancia al cap |
| ---------------------- | --------------------- | ------------ | ---- | ---------------- |
| `discussions` (raíz)   | 6371                  | **6187**     | 1500 | -4687            |
| `discussions/presence` | 872                   | 872          | 1500 | +628             |
| (resto sin cambios)    | —                     | —            | —    | —                |

**Bajada B.2: 132 + 45 + 7 = 184 LOC** (`thread-presence.tsx` 132 + `post-readers-block.tsx` 45 + `export type PostReader` de `queries.ts` 7).

**Honestidad sobre la excepción de tamaño:** B.2 reduce 184 LOC. **No cierra la excepción.** Aún consolidando todo lo pendiente (B.3 threads -550, B.4 posts -300/-600, B.5 comments -400/-800), raíz queda en ~3500-4500 LOC — el cap 1500 no es alcanzable con el dominio actual sin sub-split más fino o aceptando una excepción permanente con cap mayor.

### 7.3 Sub-splitting de B.2 — TRES commits secuenciales

Razones para splittear (no todo-en-uno):

- Riesgo distinto por archivo (thread-presence toca runtime presence; post-readers-block es SSR).
- Granularidad reversible: si smoke detecta regresión, los siguientes no se pushean.

#### B.2a — Test legacy duplicado (LOW RISK, ~10 min)

**Scope:** `src/features/discussions/__tests__/reader-stack.test.tsx`.

**Bajada:** 0 LOC prod.

**Verificación:** typecheck + lint + vitest.

**Smoke:** N/A (no toca runtime).

#### B.2b — `post-readers-block.tsx` legacy + test + cleanup `PostReader` en queries.ts (MEDIUM RISK, ~25 min)

**Scope:**

- `src/features/discussions/ui/post-readers-block.tsx`
- `src/features/discussions/__tests__/post-readers-block.test.tsx`
- `discussions/server/queries.ts`: borrar `export type PostReader` (líneas 224-240, type + JSDoc completo).

**Pre-borrado gates:**

```bash
# 0 importadores de runtime (sólo test)
grep -rn "ui/post-readers-block\|/post-readers-block['\"]" src tests | grep -v "presence/"
# Esperado: SOLO __tests__/post-readers-block.test.tsx:17

# PostReader no usado internamente en queries.ts
grep -n "PostReader" src/features/discussions/server/queries.ts
# Esperado: sólo el bloque a borrar (líneas 224-240)
```

**Verificación post-borrado:** typecheck + lint + vitest + boundaries + `ANALYZE=true pnpm build`.

**Smoke manual obligatorio en preview:**

1. `/conversations/<post>` con DevTools — bloque "X leyeron" presente (SSR), sin warnings de hydration.
2. `/library/<cat>/<item>` — idem.

**Bajada:** 45 + 7 = 52 LOC.

#### B.2c — `thread-presence.tsx` legacy (MEDIUM-HIGH RISK, ~25 min)

**Scope:** `src/features/discussions/ui/thread-presence.tsx`.

**Pre-borrado gates:**

```bash
grep -rn "ui/thread-presence['\"]" src tests
# Esperado: 0

grep -n "thread-presence" src/features/discussions/presence/ui/thread-presence-lazy.tsx
# Esperado: import('./thread-presence') (path al sub-slice)
```

**Verificación post-borrado:** typecheck + lint + vitest + boundaries + `helpers-realtime.test.ts` + `post-read.test.ts` + `ANALYZE=true pnpm build`.

**Smoke manual obligatorio en preview:**

1. `/conversations/<post>` con DevTools.
   - Network: chunk lazy presence carga post-FCP. Aceptable hasta +5 kB delta vs baseline.
   - Console: sin `cannot add presence callbacks ... after subscribe()`.
   - Visual: avatares de presence aparecen tras 1-2s.
2. Mismo thread en otra tab/perfil → avatar del otro viewer aparece.
3. `/library/<cat>/<item>`: idem.
4. Cambio a otra tab por 6s y volver: dwell tracker pausa+reanuda silenciosamente.

**Bajada:** 132 LOC.

### 7.4 Riesgos B.2 (específicos, no genéricos)

| #   | Riesgo                                                                                                                   | Probabilidad | Impacto | Mitigación                                                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------ | ------------ | ------- | --------------------------------------------------------------------------------------------------------------------- |
| 1   | Webpack reorganiza chunks al borrar `thread-presence` legacy y el lazy del sub-slice gana/pierde gzip                    | media        | medio   | `ANALYZE=true pnpm build` antes/después de B.2c. Aceptar ±5 kB; revert si >5 kB                                       |
| 2   | El lazy chunk del sub-slice falla en runtime (regresión del bug original) y como ya no hay copia legacy queda muerto     | baja         | alto    | Smoke manual obligatorio en preview ANTES de merge. RLS test enforce SQL function                                     |
| 3   | Borrar `export type PostReader` rompe a un consumer no detectado                                                         | baja         | medio   | `grep -rn "PostReader" src tests` post-borrado debe mostrar 0 hits fuera de `presence/server/queries/post-readers.ts` |
| 4   | Sub-slice tiene un fallo en cobertura del test borrado                                                                   | baja         | bajo    | Diff verificado: 1 línea de delta. Misma cobertura                                                                    |
| 5   | Comentario obsoleto en `presence/ui/thread-presence.tsx:46` queda apuntando a "copia legacy" inexistente                 | alta         | bajo    | Actualizar en C.5 (restaurar comentario rico del legacy)                                                              |
| 6   | Comentario en `queries.ts:230` referencia el `legacy ui/post-readers-block.tsx`. Al borrar B.2b ese argumento desaparece | alta         | nulo    | El bloque entero (líneas 224-240) se borra como parte de B.2b                                                         |
| 7   | Otra sesión paralela toca presence mientras B.2 está en limbo                                                            | baja         | medio   | Cerrar B.2a → B.2b → B.2c en sesiones consecutivas; máx 2 días gap                                                    |
| 8   | `check-slice-size.ts` sigue rojo en `discussions` post-B.2                                                               | media        | bajo    | Mencionar en commit message: "discussions raíz baja 6371→6187, sigue en violación, deuda B.3/B.4/B.5"                 |

### 7.5 Plan C detallado (7 superficies)

#### C.1 — `docs/decisions/2026-04-20-discussions-size-exception.md`

- Update box "Update 2026-05-09: Sub-slice presence consolidado" + tabla LOC actualizada.
- Nueva sección "## Pendientes para cerrar la excepción" con checklist de B.3/B.4/B.5.
- Honestidad: el cap 1500 no es alcanzable; la excepción quedará vigente con cap mayor autorizado.

#### C.2 — `docs/decisions/2026-05-09-realtime-presence-topic-split.md`

- Reemplazar bullet sobre "duplicación temporal de thread-presence.tsx" por uno que confirme consolidación.

#### C.3 — `docs/gotchas/supabase-channel-topic-collision.md`

- En § "Fix aplicado", reemplazar bullet sobre 2 archivos (legacy + sub-slice) por uno solo apuntando al sub-slice.

#### C.4 — `members/ui/resend-invitation-button.tsx` y `members/invitations/ui/resend-invitation-button.tsx` (línea 18 cada uno)

- Cambiar `discussions/ui/dwell-tracker.tsx` → `discussions/presence/ui/dwell-tracker.tsx` en comentario JSDoc.

#### C.5 — `src/features/discussions/presence/ui/thread-presence.tsx` líneas 43-47

- Restaurar el comentario rico que vivía en el legacy (era el delta de 4 líneas verificado por diff). Era valor histórico/documentación de la trampa Realtime; debe persistir en la única copia restante.

#### C.6 — Cross-refs path actualizados

- `composers/mention-prefetch-provider.tsx:29`: `thread-presence-lazy.tsx` → `presence/ui/thread-presence-lazy.tsx`.
- `member-detail-header.test.tsx:6`: `reader-stack.test.tsx` → `presence/__tests__/reader-stack.test.tsx`.

#### C.7 — `src/features/discussions/presence/README.md` (NUEVO, opcional pero recomendado)

- ≤ 50 LOC orientando al próximo dev: componentes, server, action, boundaries, topic Realtime, plan de creación.

**Commit C único:** `docs(presence): cerrar sub-slice migration plan + actualizar refs cruzadas`.

### 7.6 Test plan integral cierre del refactor (post B.2 + C)

```bash
# Ningún archivo del legacy presence sigue importado externamente
grep -rn "from '@/features/discussions/ui/thread-presence\|from '@/features/discussions/ui/post-readers-block\|from '@/features/discussions/ui/post-unread-dot\|from '@/features/discussions/ui/reader-stack\|from '@/features/discussions/ui/dwell-tracker\|from '@/features/discussions/server/place-opening\|from '@/features/discussions/server/actions/reads" src tests
# Esperado: 0

# Boundaries respetadas
pnpm test --run tests/boundaries.test.ts

# RLS de presence
pnpm test --run tests/rls/helpers-realtime.test.ts tests/rls/post-read.test.ts

# Bundle equivalente
ANALYZE=true pnpm build
# /conversations/[postSlug]: 292 kB ±2; /library/[categorySlug]/[itemSlug]: 295 kB ±2

# LOC final
pnpm tsx scripts/lint/check-slice-size.ts
# Esperado: discussions raíz 6187 LOC; presence 872
```

**Smoke checklist final:** ver § 4.3 del sub-plan original (URLs, Network, Console, comportamiento).

### 7.7 Cronograma estimado

| Sub-fase             | Trabajo                                | Estimado                                |
| -------------------- | -------------------------------------- | --------------------------------------- |
| Pre-flight           | Auditoría con greps                    | 15 min                                  |
| B.2a                 | Borrar test legacy                     | 10 min                                  |
| B.2b                 | Borrar componente + test + PostReader  | 25 min                                  |
| B.2c                 | Borrar thread-presence + ANALYZE build | 25 min                                  |
| Push + preview smoke |                                        | 20 min                                  |
| C                    | 7 superficies de docs                  | 30 min                                  |
| Push + final preview |                                        | 10 min                                  |
| **Total**            |                                        | **~2h 15min, splittable en 2 sesiones** |

### 7.8 Follow-ups post-B.2 (deuda explícita, NO incluir acá)

- **B.3** — ✅ **CERRADO 2026-05-09**: `discussions/threads/` consolidado en 5 sub-commits + C (docs). Re-cableo `ThreadHeaderBar` + `PostList` al sub-slice + borrado de 9 archivos legacy + cleanup oportunista `reader-stack`/`post-unread-dot`. **-600 LOC al raíz** (de 6202 a 5602, match perfecto con la predicción del plan). Bundle byte-idéntico al baseline (`/conversations` 290 kB). Plan: `docs/plans/2026-05-09-threads-subslice-migration.md`. Audit: `docs/plans/2026-05-09-threads-subslice-migration-audit.md`. Cierra TODOS los sub-slices accionables de `discussions/`.
- **B.4** — `discussions/posts/` consolidation: borrar `listPostsByPlace` legacy + 3 helpers privados + `load-more.ts` legacy. -300 a -600 LOC.
- **B.5** — `discussions/comments/` consolidation: borrar `findCommentById`, `listCommentsByPost`, `CommentView` legacy. -400 a -800 LOC.
- **F1** (del sub-plan original) — `presence/__tests__/post-event-relation.test.ts` mal ubicado, mover a `posts/__tests__/`.
- **F2** — acoplamiento cross-sub-slice de helpers privados de presence consumidos por posts.
- **WHITELIST** del slice-size script vacía — discutir si re-poblar o eliminar el script.

Total ~4-5h efectivas. Ventana entre sesiones puede ser días sin riesgo (Fase A es no-op semántico).
