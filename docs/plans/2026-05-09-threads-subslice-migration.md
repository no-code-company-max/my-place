# Plan B.3 — Migración del sub-slice `discussions/threads/`

> **Plan to save as:** `docs/plans/2026-05-09-threads-subslice-migration.md`
> **Estado:** Pendiente de aprobación
> **Owner:** Maxi
> **Origen:** Follow-up B.3 documentado en § 7.8 del plan padre `docs/plans/2026-05-09-presence-subslice-migration.md` post-merge del commit `5e4e596` (B.2c, deployed). Sub-slice `discussions/threads/` existe desde refactors previos pero quedó huérfano (cero consumers externos) — esta migración cierra la deuda re-cableando los 2 exports del barrel raíz que apuntan al legacy y borra los archivos legacy + un test duplicado.

---

## 0. Estado verificado (auditoría 2026-05-09 post-`5e4e596`)

### 0.1 LOC actual del slice + sub-slice

Salida literal de `pnpm tsx scripts/lint/check-slice-size.ts`:

```
✗  discussions                   6176 / 1500 (-4676)
✓  discussions/threads            531 / 1500 (+969)
✓  discussions/comments          1354 / 1500 (+146)
✓  discussions/presence           872 / 1500 (+628)
✓  discussions/posts             1004 / 1500 (+496)
✓  discussions/reactions          368 / 1500 (+1132)
✓  discussions/composers          192 / 1500 (+1308)
✓  discussions/moderation         170 / 1500 (+1330)
```

`discussions` raíz viola cap por **4676 LOC** (excepción autorizada por `docs/decisions/2026-04-20-discussions-size-exception.md`). El WHITELIST del script está vacío post-2026-05-04 — el slice **falla** `pnpm tsx scripts/lint/check-slice-size.ts` con exit 1 hoy. Esto es estado heredado, no introducido por B.3.

### 0.2 Inventario completo del sub-slice `threads/`

Directorio `src/features/discussions/threads/` (verificado por `ls`):

| Archivo                                  | LOC | Diferencia vs legacy `discussions/ui/`                                                                                                                            |
| ---------------------------------------- | --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `public.ts`                              | 15  | exporta `EmptyThreads`, `FeaturedThreadCard`, `LoadMorePosts`, `PostList`, `ThreadFilterPills`, `ThreadHeaderBar`, `ThreadRow`. NO exporta `ThreadsSectionHeader` |
| `ui/empty-threads.tsx`                   | 62  | 1 línea (path: relativo `../domain/filter` → absoluto `@/features/...`)                                                                                           |
| `ui/featured-thread-card.tsx`            | 79  | 4 líneas: paths absolutos + `ReaderStack`/`PostUnreadDot` desde `presence/public` (legacy importa el local roto)                                                  |
| `ui/load-more-posts.tsx`                 | 70  | 5 líneas: paths absolutos + `friendlyErrorMessage` desde `discussions/ui/utils` cross-sub-slice                                                                   |
| `ui/post-list.tsx`                       | 70  | 2 líneas (paths)                                                                                                                                                  |
| `ui/thread-filter-pills.tsx`             | 88  | 4 líneas (formato multi-línea del import)                                                                                                                         |
| `ui/thread-header-bar.tsx`               | 41  | **byte-idéntico** a legacy                                                                                                                                        |
| `ui/thread-row.tsx`                      | 76  | 4 líneas (paths absolutos + `ReaderStack`/`PostUnreadDot` desde `presence/public`)                                                                                |
| `ui/threads-section-header.tsx`          | 31  | **byte-idéntico** a legacy                                                                                                                                        |
| `__tests__/thread-filter-pills.test.tsx` | 127 | **byte-idéntico** a legacy `discussions/__tests__/thread-filter-pills.test.tsx`                                                                                   |

**Total `threads/`:** 531 LOC prod (sin tests).

Comandos exactos para reproducir:

```bash
ls -la src/features/discussions/threads/ src/features/discussions/threads/ui/ src/features/discussions/threads/__tests__/

for f in empty-threads featured-thread-card load-more-posts post-list thread-filter-pills thread-header-bar thread-row threads-section-header; do
  echo "===== $f ====="
  diff src/features/discussions/ui/$f.tsx src/features/discussions/threads/ui/$f.tsx
done

diff src/features/discussions/__tests__/thread-filter-pills.test.tsx \
     src/features/discussions/threads/__tests__/thread-filter-pills.test.tsx
```

Verifiqué cada diff: `thread-header-bar` y `threads-section-header` son byte-idénticos; el resto difieren **solo en imports** (paths relativos del legacy → paths absolutos del sub-slice + en `featured-thread-card`/`thread-row` migran de `./reader-stack`/`./post-unread-dot` a `presence/public`). **No hay drift de lógica en ningún archivo del sub-slice.**

### 0.3 Inventario de los archivos legacy en `discussions/ui/`

| Archivo legacy                  | LOC | Estado en `public.{ts,server.ts}`                            | Importadores internos al slice                               |
| ------------------------------- | --- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| `ui/empty-threads.tsx`          | 62  | NO se re-exporta. Solo `post-list.tsx` legacy lo usa interno | `ui/post-list.tsx` (legacy)                                  |
| `ui/featured-thread-card.tsx`   | 79  | NO se re-exporta. Solo `post-list.tsx` legacy                | `ui/post-list.tsx`                                           |
| `ui/load-more-posts.tsx`        | 70  | NO se re-exporta. Solo `post-list.tsx` legacy                | `ui/post-list.tsx`                                           |
| `ui/post-list.tsx`              | 70  | **`public.server.ts:78` re-exporta** `PostList`              | `app/[placeSlug]/(gated)/conversations/page.tsx`             |
| `ui/thread-filter-pills.tsx`    | 84  | NO se re-exporta. `post-list.tsx` legacy + test legacy       | `ui/post-list.tsx`, `__tests__/thread-filter-pills.test.tsx` |
| `ui/thread-header-bar.tsx`      | 41  | **`public.ts:123` re-exporta** `ThreadHeaderBar`             | `app/[placeSlug]/(gated)/conversations/[postSlug]/page.tsx`  |
| `ui/thread-row.tsx`             | 76  | NO se re-exporta. Solo `post-list.tsx` + `load-more-posts`   | `ui/post-list.tsx`, `ui/load-more-posts.tsx`                 |
| `ui/threads-section-header.tsx` | 31  | NO se re-exporta. Solo `post-list.tsx` legacy                | `ui/post-list.tsx`                                           |

Tests legacy duplicados:

| Test legacy                                        | Estado                                                                                                                                                                                                         |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `__tests__/thread-filter-pills.test.tsx` (127 LOC) | Importa `from '../ui/thread-filter-pills'`. Sub-slice tiene un duplicado byte-idéntico apuntando a `from '../ui/thread-filter-pills'` (resuelve al sub-slice). **Duplicado verificado por diff (sin output).** |

**Total LOC borrable post-rewire:** 62 + 79 + 70 + 70 + 84 + 41 + 76 + 31 + 127 (test) = **640 LOC**, donde 513 son prod + 127 son test.

### 0.4 Consumidores externos del slice (verificado por grep)

Comando exacto:

```bash
grep -rn "from '@/features/discussions/public'\|from '@/features/discussions/public.server'\|from '@/features/discussions/threads/public'" src tests | grep -v "discussions/" | sort -u
```

Salida esperada (subset relevante a B.3):

| Caller                                      | Importa           | De                          |
| ------------------------------------------- | ----------------- | --------------------------- |
| `(gated)/conversations/page.tsx`            | `PostList`        | `discussions/public.server` |
| `(gated)/conversations/[postSlug]/page.tsx` | `ThreadHeaderBar` | `discussions/public`        |

**Cero consumidores externos** importan desde `discussions/threads/public` directamente. Solo el barrel raíz (`discussions/public.{ts,server.ts}`) re-exporta `ThreadHeaderBar` y `PostList`.

**Verificación clave: `/library/[categorySlug]/page.tsx` NO usa `PostList`** — usa `ItemList` desde `library/public`. Solo `/conversations` usa `PostList`. La home gated del library tiene su propia composición y queda **fuera del scope de B.3**.

### 0.5 Cableo del action `loadMorePostsAction`

`loadMorePostsAction` vive en `src/features/discussions/server/actions/load-more.ts` (legacy). Es exportado desde `discussions/public.ts:97-99` (cross-slice). El sub-slice `threads/ui/load-more-posts.tsx` lo importa via path absoluto `@/features/discussions/server/actions/load-more`.

**No es scope B.3.** Su movimiento al sub-slice posts/ (con `loadMoreCommentsAction` mudándose a comments/) es deuda B.4/B.5. Por ahora, queda donde está y el sub-slice threads/ lo consume cross-sub-slice por path absoluto — patrón ya validado por `friendlyErrorMessage` (consumido cross-sub-slice por presence/, comments/, reactions/, moderation/).

### 0.6 Cableo del helper `friendlyErrorMessage`

Vive en `src/features/discussions/ui/utils.ts` (62 LOC). Es importado desde:

- `discussions/ui/{load-more-posts, comment-admin-menu, reaction-bar, post-admin-menu, load-more-comments, edit-window-confirm-delete}.tsx` (legacy, paths relativos)
- `discussions/comments/ui/{load-more-comments, comment-admin-menu}.tsx` (sub-slice, path absoluto)
- `discussions/reactions/ui/reaction-bar.tsx` (sub-slice, path absoluto)
- `discussions/moderation/ui/post-admin-menu.tsx` (sub-slice, path absoluto)
- `discussions/threads/ui/load-more-posts.tsx` (sub-slice, path absoluto) ← post B.3 sigue así
- `discussions/__tests__/friendly-error-message.test.tsx`
- `events/ui/errors.ts` referencia el path por comentario (no import)

Es un helper de UI shared. Su consolidación (mover a `discussions/ui-shared/utils.ts` o `shared/`) es deuda separada, **no incluida en B.3**.

### 0.7 Cableo del helper `presence/`

`featured-thread-card.tsx` y `thread-row.tsx` del sub-slice importan `ReaderStack` y `PostUnreadDot` desde `@/features/discussions/presence/public`. Las copias legacy en `discussions/ui/` importan `./reader-stack` y `./post-unread-dot` (archivos sin re-export en el barrel raíz, vivos solo por consumo interno desde estos 2 callers — mismo patrón que el plan padre § 7.1.2 marcó como código muerto a partir de B.2c). Verifico que post-B.3 quedan también huérfanos:

```bash
grep -rn "from '\\./reader-stack'\|from '\\./post-unread-dot'" src tests | grep -v "presence/"
```

Esperado **post-B.3**: solo refs internos al legacy `featured-thread-card.tsx` y `thread-row.tsx` que se borran. Tras B.3 esos 2 archivos legacy más sus consumers de `reader-stack`/`post-unread-dot` desaparecen, con lo cual `discussions/ui/reader-stack.tsx` (72 LOC) + `discussions/ui/post-unread-dot.tsx` (15 LOC) **quedan código muerto wireado por nada** y son borrables como cleanup oportunista (ver § 3.4).

### 0.8 Flags abiertos / observaciones

- **F1.** El sub-slice `threads/public.ts` exporta 7 nombres pero no `ThreadsSectionHeader`. Es internal: solo `PostList` lo monta. No se re-exporta del barrel raíz. **OK como está.** No se modifica.
- **F2.** `loadMorePostsAction` vive en `discussions/server/actions/load-more.ts` legacy y no migra en B.3. Patrón cross-sub-slice por path absoluto (mismo que `friendlyErrorMessage`). Documentado.
- **F3.** El sub-slice `threads/__tests__/thread-filter-pills.test.tsx` ya existe **byte-idéntico** al legacy. La oportunidad real es borrar el legacy; el sub-slice ya cubre la cobertura.
- **F4.** Mientras la migración esté en limbo (entre A y B), cualquier sesión que toque `featured-thread-card.tsx`, `thread-row.tsx`, `post-list.tsx`, etc. debe actualizar AMBAS copias. Riesgo activo de drift idéntico al que tuvo presence durante A→B.
- **F5.** El cap LOC del slice raíz **no cierra con B.3** (ver § 2). La excepción de tamaño queda vigente.

---

## 1. Objetivo

**Sustantivo:** los Server/Client Components del sub-slice `threads/` son la única implementación. La API pública del slice (`discussions/public.{ts,server.ts}`) re-exporta `ThreadHeaderBar` y `PostList` desde el sub-slice (no se rompe el contrato externo: `app/[placeSlug]/(gated)/conversations/{page,[postSlug]/page}.tsx` siguen importando del barrel raíz exactamente como hoy).

**Adjetivos no negociables:**

- Zero downtime en producción.
- Tests verdes (typecheck + lint + vitest + boundaries) en cada commit.
- Bundle equivalente: `/conversations` ≤290 kB ±2 (baseline post-perf-2). El home gated `/conversations` es la entrada al place — cualquier inflación >5 kB es bloqueante.
- Reversible commit-a-commit: cada sub-fase rollbacks via `git revert` sin tocar las anteriores.
- Smoke OK en preview deploy antes de cada merge a `main`.

**Fuera de scope:**

- Migración de `loadMorePostsAction` al sub-slice posts/ (es B.4).
- Consolidación de `discussions/server/queries.ts` legacy (B.4 + B.5).
- Cleanup del legacy `discussions/ui/post-detail.tsx` y otros UI thread-related no listados (B.4/B.5).
- Movida de `friendlyErrorMessage` a `shared/`.
- Cierre de la excepción de tamaño del slice raíz (no es alcanzable post-B.3 — ver § 2).
- Tocar logs `DEBUG TEMPORAL` (mantener intactos, ver `docs/pre-launch-checklist.md`).

---

## 2. LOC accounting predicho

Estado actual (verificado):

```
discussions (raíz)   6176 LOC   (cap 1500 — viola por 4676)
discussions/threads   531 LOC   (cap 1500 — OK)
```

Cambio esperado por archivo borrado en el raíz `discussions/`:

| Archivo borrado                                      | LOC      |
| ---------------------------------------------------- | -------- |
| `ui/empty-threads.tsx`                               | -62      |
| `ui/featured-thread-card.tsx`                        | -79      |
| `ui/load-more-posts.tsx`                             | -70      |
| `ui/post-list.tsx`                                   | -70      |
| `ui/thread-filter-pills.tsx`                         | -84      |
| `ui/thread-header-bar.tsx`                           | -41      |
| `ui/thread-row.tsx`                                  | -76      |
| `ui/threads-section-header.tsx`                      | -31      |
| Cleanup oportunista `ui/reader-stack.tsx` (B.3.4)    | -72      |
| Cleanup oportunista `ui/post-unread-dot.tsx` (B.3.4) | -15      |
| **Total prod borrado**                               | **-600** |

Tests borrados (no afecta LOC del script — `__tests__/` se descarta):

| Test borrado                             | LOC  |
| ---------------------------------------- | ---- |
| `__tests__/thread-filter-pills.test.tsx` | -127 |

**Estado proyectado post-B.3:**

| Slice/sub-slice       | LOC pre-B.3 | LOC post-B.3 | Cap  | Distancia al cap |
| --------------------- | ----------- | ------------ | ---- | ---------------- |
| `discussions` (raíz)  | 6176        | **5576**     | 1500 | -4076            |
| `discussions/threads` | 531         | 531          | 1500 | +969             |

**Bajada total: -600 LOC del raíz** (incluye el cleanup oportunista de `reader-stack.tsx` + `post-unread-dot.tsx` si se valida en B.3.4 que quedaron sin consumers).

Sin el cleanup oportunista (escenario conservador): **-513 LOC del raíz** (5663 / 1500).

### Honestidad sobre la excepción de tamaño

**B.3 NO cierra la excepción autorizada por `docs/decisions/2026-04-20-discussions-size-exception.md`.** El raíz queda en ~5576 LOC (vs cap 1500) — sigue violando por **4076 LOC**.

Para aproximarse al cap haría falta también:

- **B.4 — `discussions/posts/` consolidation:** mover `findPostById/findPostBySlug/listPostsByPlace/loadMorePostsAction` del legacy `discussions/server/queries.ts` + `discussions/server/actions/load-more.ts` al sub-slice posts/. Estimado -300 a -600 LOC.
- **B.5 — `discussions/comments/` consolidation:** borrar el legacy `discussions/ui/{comment-*.tsx, load-more-comments.tsx, use-comment-realtime.ts, edit-window-*.tsx, comment-realtime-appender.tsx, post-detail.tsx}` + las queries `findCommentById/listCommentsByPost/findQuoteSource` que aún viven en `discussions/server/queries.ts`. Estimado -400 a -800 LOC.

Aún consolidando B.3 + B.4 + B.5 (rango optimista -600 + -600 + -800 = -2000), el raíz quedaría en ~4176 LOC. **El cap 1500 no es alcanzable con el dominio actual de discussions sin un sub-split más fino o una excepción permanente con cap mayor autorizada.** Se debe documentar esa realidad en el ADR `2026-04-20-discussions-size-exception.md` cuando se cierre B.5.

**Mensaje del commit final (C):** debe mencionar literalmente "discussions raíz baja 6176→5576, sigue en violación, deuda B.4/B.5 + decisión de excepción permanente pendiente".

---

## 3. Estrategia: 5 sub-commits secuenciales

### Argumento para splittear

**A favor de splittear vs. todo-en-uno:**

- Riesgo distinto entre archivos: `ThreadHeaderBar` solo cambia un re-export trivial; `PostList` re-cableado afecta runtime SSR de la home gated `/conversations`; `LoadMorePosts` es Client Component con server action.
- Granularidad reversible: si smoke en preview detecta regresión post-merge de un sub-commit, los siguientes no se ejecutan; el rollback toca un solo archivo.
- Comparación bundle aislada: el cambio que más puede mover el bundle es el rewire de `PostList` (entra al chunk de `/conversations`) — ese sub-commit se compara contra baseline `ANALYZE` independiente.

**A favor de todo-en-uno:**

- Un solo PR review; menor overhead de coordinación.
- El conjunto es semánticamente atómico (rewire+borrado del legacy thread).

**Decisión:** splittear en **5 sub-commits secuenciales**, mismo patrón que B.2 del plan padre. Riesgo distribuido + reversibilidad + bundle comparison limpia. Estimado total ~2.5 horas en 1-2 sesiones.

### Mapping de sub-commits

| Sub-commit | Riesgo | Scope                                                          | LOC prod | Smoke crítico                 |
| ---------- | ------ | -------------------------------------------------------------- | -------- | ----------------------------- |
| **B.3.1**  | LOW    | Re-wire `public.ts` (`ThreadHeaderBar` → sub-slice)            | 0        | thread detail abre OK         |
| **B.3.2**  | MED-HI | Re-wire `public.server.ts` (`PostList` → sub-slice)            | 0        | `/conversations` SSR + bundle |
| **B.3.3**  | LOW    | Borrar test legacy + 2 archivos byte-idénticos                 | -72      | typecheck + tests             |
| **B.3.4**  | LOW    | Borrar 6 archivos legacy restantes (todo el legacy thread UI)  | -441     | typecheck + tests             |
| **B.3.5**  | LOW    | Cleanup oportunista `reader-stack.tsx` + `post-unread-dot.tsx` | -87      | typecheck + tests             |
| **C**      | LOW    | Docs (ADR + plan padre + README + cross-refs)                  | 0        | N/A                           |

---

### B.3.1 — Re-wire `public.ts` (`ThreadHeaderBar` → sub-slice). LOW RISK

**Scope:**

- `src/features/discussions/public.ts:123` — cambiar `export { ThreadHeaderBar } from './ui/thread-header-bar'` por `export { ThreadHeaderBar } from './threads/public'`.

**Impacto runtime:** ninguno (los archivos son **byte-idénticos**, verificado por `diff` sin output).

**Pre-rewire gates:**

```bash
# Verificar que los archivos son byte-idénticos
diff src/features/discussions/ui/thread-header-bar.tsx \
     src/features/discussions/threads/ui/thread-header-bar.tsx
# Esperado: sin output

# Verificar consumers
grep -rn "ThreadHeaderBar" src/app
# Esperado: solo conversations/[postSlug]/page.tsx + comentarios
```

**Verificación post-rewire:**

```bash
pnpm typecheck
pnpm lint
pnpm vitest run
pnpm test --run tests/boundaries.test.ts
```

**Smoke manual obligatorio en preview deploy:**

1. `/conversations/<post-baseline>` — header bar pinta inmediato con back button. Sin warnings React/hydration.
2. Abrir post propio dentro de ventana edit (60s) — kebab admin renderiza al lado del back button.

**Rollback:** `git revert <hash>` del sub-commit. Sin efectos colaterales (los 2 archivos siguen presentes).

**Commit message:**

```
refactor(discussions): re-wire public.ts ThreadHeaderBar a sub-slice threads/ (B.3.1)
```

---

### B.3.2 — Re-wire `public.server.ts` (`PostList` → sub-slice). MEDIUM-HIGH RISK

**Scope:**

- `src/features/discussions/public.server.ts:78` — cambiar `export { PostList } from './ui/post-list'` por `export { PostList } from './threads/public'`.

**Impacto runtime:**

- `PostList` cambia de path. La implementación es semánticamente equivalente (diff verificado: 2 líneas de paths). Pero entra al chunk SSR de `/conversations`, que es la home gated del place — cualquier reordering de chunks por webpack puede inflar/contraer el First Load JS.
- Subimos `featured-thread-card`, `thread-row`, `empty-threads`, `thread-filter-pills`, `threads-section-header`, `load-more-posts` desde el sub-slice — pero los archivos son los mismos a nivel de bytes excepto los paths.

**Pre-rewire gates:**

```bash
# Verificar diffs aceptables (solo paths)
for f in post-list featured-thread-card thread-row empty-threads thread-filter-pills threads-section-header load-more-posts; do
  echo "===== $f ====="
  diff src/features/discussions/ui/$f.tsx src/features/discussions/threads/ui/$f.tsx
done
# Esperado: solo líneas de import; sin diff de lógica

# Capturar baseline bundle
ANALYZE=true pnpm build > /tmp/build-baseline.log 2>&1
# Anotar tamaño exacto reportado para /conversations
```

**Verificación post-rewire:**

```bash
pnpm typecheck
pnpm lint
pnpm vitest run
pnpm test --run tests/boundaries.test.ts
ANALYZE=true pnpm build > /tmp/build-post.log 2>&1
# Comparar /conversations: aceptar Δ ±5 kB; revert si >+5 kB
```

**Smoke manual obligatorio en preview deploy:**

1. `/conversations` (memberA en E2E_PLACES.palermo) con DevTools abierto.
   - **SSR renderiza la lista**: ver el HTML del primer paint contiene `<article>` con el post baseline.
   - **Filter pills funcionan**: click en "Sin respuesta" → URL cambia a `?filter=unanswered`, lista re-renderiza.
   - **Empty state**: navegar a `?filter=participating` con un viewer que no participó → renderiza el empty state correcto.
   - **Featured + ThreadRow**: el primer post sale como `FeaturedThreadCard` (chrome con border + padding); el resto como `ThreadRow` apilados.
   - **LoadMorePosts**: con >50 posts, scroll abajo + click "Ver más" → 2da página carga sin errores. Chequear Network: el server action dispara y el bundle del Client Component carga lazy.
   - **PostUnreadDot + ReaderStack**: posts no leídos muestran el dot junto al título; readers aparecen en el footer si hay.
2. `/library/[categorySlug]` — confirmar visualmente que **NO se rompió** (no usa `PostList`, debería ser idéntico).
3. Network tab: First Load JS de `/conversations` ≤295 kB. Si >295 kB, **revert obligatorio**.

**Rollback:** `git revert <hash>`. Los 2 archivos legacy + sub-slice siguen presentes; vuelve al cableo legacy.

**Commit message:**

```
refactor(discussions): re-wire public.server.ts PostList a sub-slice threads/ (B.3.2)
```

---

### B.3.3 — Borrar test legacy + 2 archivos byte-idénticos. LOW RISK

**Scope:**

- `src/features/discussions/__tests__/thread-filter-pills.test.tsx` (127 LOC, byte-idéntico al sub-slice).
- `src/features/discussions/ui/thread-header-bar.tsx` (41 LOC, byte-idéntico al sub-slice, 0 importadores post-B.3.1).
- `src/features/discussions/ui/threads-section-header.tsx` (31 LOC, byte-idéntico al sub-slice, 0 importadores externos).

**Pre-borrado gates:**

```bash
# 0 importadores externos del thread-header-bar legacy
grep -rn "ui/thread-header-bar['\"]" src tests | grep -v "discussions/threads/"
# Esperado: 0 (post-B.3.1 el público ya apunta al sub-slice)

# 0 importadores del threads-section-header legacy excepto post-list legacy (que también muere)
grep -rn "threads-section-header" src tests | grep -v "discussions/threads/"
# Esperado: solo discussions/ui/post-list.tsx (legacy, todavía vivo) + tests/e2e comment

# Test legacy filter-pills no es referenciado externo
grep -rn "thread-filter-pills.test" src tests | grep -v "discussions/threads/"
# Esperado: solo el archivo a borrar
```

**IMPORTANTE — orden:** `threads-section-header.tsx` lo importa el legacy `post-list.tsx`. Si borramos `threads-section-header.tsx` antes de borrar `post-list.tsx` legacy (B.3.4), `post-list.tsx` legacy queda con import roto → typecheck rompe. **Solución:** borrar **`thread-header-bar.tsx`** y el **test legacy** acá, dejar `threads-section-header.tsx` para B.3.4.

**Scope corregido B.3.3:**

- Borrar `src/features/discussions/__tests__/thread-filter-pills.test.tsx` (127 LOC).
- Borrar `src/features/discussions/ui/thread-header-bar.tsx` (41 LOC).

**Bajada B.3.3:** -41 LOC prod, -127 LOC test.

**Verificación post-borrado:**

```bash
pnpm typecheck
pnpm lint
pnpm vitest run
pnpm test --run tests/boundaries.test.ts
pnpm tsx scripts/lint/check-slice-size.ts
# Esperado: discussions raíz 6176 - 41 = 6135 LOC
```

**Smoke manual:** N/A (los 2 archivos no estaban siendo importados por nadie post-B.3.1).

**Rollback:** `git revert <hash>` restaura ambos archivos.

**Commit message:**

```
refactor(discussions): borrar thread-header-bar legacy + test filter-pills duplicado (B.3.3)
```

---

### B.3.4 — Borrar 6 archivos legacy restantes (resto del thread UI). MEDIUM RISK

**Scope (en orden de borrado):**

Para evitar imports rotos transitorios (typecheck rompe si el orden es inverso), borrar primero el wrapper `post-list.tsx` y `load-more-posts.tsx`, luego sus dependencias:

1. `src/features/discussions/ui/post-list.tsx` (70 LOC) — composer del chrome. Importa los otros 5.
2. `src/features/discussions/ui/load-more-posts.tsx` (70 LOC) — Client Component con server action. Importa `thread-row.tsx`.
3. `src/features/discussions/ui/threads-section-header.tsx` (31 LOC) — solo lo usaba `post-list.tsx`.
4. `src/features/discussions/ui/thread-filter-pills.tsx` (84 LOC) — solo lo usaba `post-list.tsx` (test legacy ya borrado en B.3.3).
5. `src/features/discussions/ui/empty-threads.tsx` (62 LOC) — solo lo usaba `post-list.tsx`.
6. `src/features/discussions/ui/featured-thread-card.tsx` (79 LOC) — solo lo usaba `post-list.tsx`.
7. `src/features/discussions/ui/thread-row.tsx` (76 LOC) — solo lo usaban `post-list.tsx` y `load-more-posts.tsx`.

Total borrado: 7 archivos, **472 LOC prod**.

**Pre-borrado gates (correr ANTES de cada borrado):**

```bash
# Confirmar que SOLO se importan internamente entre los 7 (que mueren juntos)
# y que ningún caller externo ni sub-slice los importa.

for f in post-list load-more-posts threads-section-header thread-filter-pills empty-threads featured-thread-card thread-row; do
  echo "===== $f ====="
  grep -rn "ui/$f['\"]" src tests | grep -v "discussions/threads/"
done
# Esperado:
#  - post-list:  public.server.ts:78 (legacy ref que ya migró en B.3.2 — ¡cuidado! verificar en commit B.3.2 que public.server.ts apunta al sub-slice antes de borrar)
#  - load-more-posts:  solo discussions/ui/post-list.tsx (legacy, también borrable)
#  - threads-section-header: solo discussions/ui/post-list.tsx
#  - thread-filter-pills: solo discussions/ui/post-list.tsx (test legacy ya borrado en B.3.3)
#  - empty-threads: solo discussions/ui/post-list.tsx + comentario en page.tsx (no es import)
#  - featured-thread-card: solo discussions/ui/post-list.tsx + comentarios
#  - thread-row: solo discussions/ui/post-list.tsx + discussions/ui/load-more-posts.tsx
```

**Drift análisis previo al borrado:**

```bash
# Confirmar que ningún archivo del set divergió desde la auditoría inicial
for f in post-list load-more-posts threads-section-header thread-filter-pills empty-threads featured-thread-card thread-row; do
  echo "===== $f ====="
  diff src/features/discussions/ui/$f.tsx src/features/discussions/threads/ui/$f.tsx
done
# Esperado: solo líneas de import (ya verificado en auditoría 0.2).
# Si aparece OTRO diff (lógica), pausar y resolver — el sub-slice debe ser el snapshot funcional.
```

**Verificación post-borrado:**

```bash
pnpm typecheck
pnpm lint
pnpm vitest run
pnpm test --run tests/boundaries.test.ts
ANALYZE=true pnpm build > /tmp/build-post-b34.log 2>&1
# Comparar bundle vs baseline + B.3.2
pnpm tsx scripts/lint/check-slice-size.ts
# Esperado: discussions raíz 6135 - 472 = 5663 LOC
```

**Smoke manual obligatorio en preview deploy:**

1. **`/conversations` (memberA en palermo)** — re-test del set completo de B.3.2:
   - SSR pinta lista con featured + rows.
   - Filter pills funcionan + URL state.
   - Empty state contextual por filter.
   - LoadMorePosts: 2da página carga.
   - Featured/ThreadRow tienen los chromes correctos (border, padding, divider).
   - PostUnreadDot + ReaderStack visibles cuando aplica.
2. **`/conversations` con `?filter=unanswered` y luego `?filter=participating`** — confirmar estados intermedios.
3. **`/conversations/<post>`** — abrir un thread, volver con BackButton — el `?from=conversations` preserva el origin.
4. **`/library/[categorySlug]`** — confirmar que sigue idéntico (no usa `PostList`).
5. **DevTools Network**: First Load JS `/conversations` ≤295 kB. Si >295 kB, **revert obligatorio**.

**Rollback:** `git revert <hash>` restaura los 7 archivos. El barrel raíz queda apuntando al sub-slice (de B.3.1 + B.3.2), pero las copias legacy vuelven a existir como código muerto.

**Commit message:**

```
refactor(discussions): borrar 7 archivos legacy thread-related (B.3.4)
```

---

### B.3.5 — Cleanup oportunista `reader-stack.tsx` + `post-unread-dot.tsx`. LOW RISK

**Justificación:** post-B.3.4, los únicos consumers de `discussions/ui/reader-stack.tsx` (72 LOC) y `discussions/ui/post-unread-dot.tsx` (15 LOC) eran `featured-thread-card.tsx` y `thread-row.tsx` — ya borrados. El plan padre de presence § 7.1.2 los identificó como "TIED a B.3 — NO se borra en B.2" porque dependían de archivos thread legacy. Ahora ese vínculo se rompe.

**Pre-borrado gates:**

```bash
# 0 importadores de reader-stack y post-unread-dot legacy
grep -rn "ui/reader-stack['\"]" src tests | grep -v "presence/"
grep -rn "ui/post-unread-dot['\"]" src tests | grep -v "presence/"
# Esperado: 0 hits (post-B.3.4 los únicos callers — featured-thread-card/thread-row legacy — están borrados)
```

**Si la pre-gate muestra ≥1 hit:** flag y resolver antes de borrar. Posibilidades: comentario en otro archivo (ignorable) o un nuevo caller introducido en sesión paralela (revertir y revaluar).

**Scope:**

- `src/features/discussions/ui/reader-stack.tsx` (72 LOC).
- `src/features/discussions/ui/post-unread-dot.tsx` (15 LOC).

**Bajada:** -87 LOC prod.

**Verificación post-borrado:**

```bash
pnpm typecheck
pnpm lint
pnpm vitest run
pnpm test --run tests/boundaries.test.ts
pnpm tsx scripts/lint/check-slice-size.ts
# Esperado: discussions raíz 5663 - 87 = 5576 LOC
```

**Smoke manual:** N/A (los 2 archivos no se importan).

**Rollback:** `git revert <hash>`.

**Commit message:**

```
refactor(discussions): cleanup oportunista reader-stack + post-unread-dot legacy (B.3.5)
```

---

### C — Documentación + cross-refs. LOW RISK

**Scope (5 superficies):**

#### C.1 — `docs/decisions/2026-04-20-discussions-size-exception.md`

- Sumar entry "Update 2026-05-09 (B.3): Sub-slice threads consolidado":
  - Tabla LOC actualizada: raíz 6176 → 5576.
  - Confirmar que B.3 cierra todos los exports legacy thread-related del barrel raíz.
  - Sección "Pendientes para cerrar la excepción" — listar B.4 (-300/-600), B.5 (-400/-800) y la nota de honestidad: cap 1500 no alcanzable, evaluar excepción permanente con cap mayor cuando se cierre B.5.

#### C.2 — `docs/plans/2026-05-09-presence-subslice-migration.md`

- En § 7.8 marcar **B.3 como cerrado**: agregar fecha + commit hash final del set.
- Mantener referencias a B.4 y B.5 como deuda activa.

#### C.3 — `src/features/discussions/threads/README.md` (NUEVO, opcional pero recomendado)

- Replicar el patrón de `presence/README.md`: ≤50 LOC, describir componentes, public surface, dependencias cross-sub-slice (`presence/`, `discussions/ui/utils.ts`, `discussions/server/actions/load-more.ts`), origen del plan B.3.

#### C.4 — Cross-refs en otros archivos

- `src/app/[placeSlug]/settings/members/components/member-search-bar.tsx:13` — actualizar comentario de referencia: `discussions/ui/thread-filter-pills.tsx` → `discussions/threads/ui/thread-filter-pills.tsx`.

#### C.5 — Si aplicara, actualizar `docs/gotchas/public-server-split.md`

- No requiere cambios (B.3 mantiene el patrón). Verificar y dejar como está.

**Verificación:**

```bash
pnpm typecheck
pnpm lint
pnpm test --run tests/boundaries.test.ts
```

**Commit message:**

```
docs(threads): cerrar B.3 sub-slice migration plan + cross-refs
```

---

## 4. Verificación y smoke check (cierre del refactor)

### 4.1 Comandos integrales post-B.3 (todos los sub-commits aplicados)

```bash
# Tipos + lint + tests + boundaries
pnpm typecheck
pnpm lint
pnpm vitest run
pnpm test --run tests/boundaries.test.ts

# Bundle equivalente vs baseline (capturado pre-B.3)
ANALYZE=true pnpm build
# /conversations: ≤295 kB (baseline 290 kB + tolerancia 5 kB)
# /library/[categorySlug]: ≤300 kB (baseline 295 kB + tolerancia 5 kB)

# LOC final
pnpm tsx scripts/lint/check-slice-size.ts
# Esperado: discussions raíz 5576 LOC; threads 531 LOC

# E2E smoke en CI (post-merge)
pnpm playwright test tests/e2e/flows/post-crud.spec.ts
pnpm playwright test tests/e2e/flows/zone-swipe.spec.ts
```

### 4.2 Verificaciones grep finales

```bash
# Ningún caller externo importa el legacy thread UI
grep -rn "from '@/features/discussions/ui/post-list\|from '@/features/discussions/ui/featured-thread-card\|from '@/features/discussions/ui/thread-row\|from '@/features/discussions/ui/empty-threads\|from '@/features/discussions/ui/thread-filter-pills\|from '@/features/discussions/ui/thread-header-bar\|from '@/features/discussions/ui/threads-section-header\|from '@/features/discussions/ui/load-more-posts\|from '@/features/discussions/ui/reader-stack\|from '@/features/discussions/ui/post-unread-dot" src tests
# Esperado: 0

# El sub-slice threads no es importado externamente (sigue siendo internal al slice)
grep -rn "from '@/features/discussions/threads/" src tests | grep -v "discussions/"
# Esperado: 0 (el patrón es: callers externos → discussions/public(.server) → re-export desde threads/public)

# Boundary rules respetadas
pnpm test --run tests/boundaries.test.ts
```

### 4.3 Smoke checklist manual obligatorio (en preview deploy de cada sub-commit)

**URLs a visitar (memberA / E2E_PLACES.palermo):**

1. **`/conversations`** (home gated — entrada al place):
   - [ ] SSR pinta lista de threads inmediato (FCP <300ms ideal).
   - [ ] Featured card visible (primer post con border + padding 18).
   - [ ] ThreadRows apilados con divider hairline.
   - [ ] Filter pills clickables (`Todos`, `Sin respuesta`, `En los que participo`); URL refleja `?filter=`.
   - [ ] Click "Todos" desde otro filter borra el query param (URL limpia).
   - [ ] PostUnreadDot visible junto al título de posts no leídos.
   - [ ] ReaderStack visible en footer cuando hay readers.
   - [ ] Posts dormidos (≥30 días) tienen opacity reducida.
2. **`/conversations?filter=unanswered`**:
   - [ ] Lista filtrada o empty state ("Todas las discusiones tienen respuesta") sin CTA.
3. **`/conversations?filter=participating`**:
   - [ ] Lista filtrada o empty state ("Todavía no participaste").
4. **`/conversations` con >50 posts** (place de stress):
   - [ ] Botón "Ver más discusiones" aparece bajo la lista.
   - [ ] Click → 2da página carga; ThreadRows nuevos aparecen apilados; sin re-renderizar la 1ra página.
   - [ ] Network: chunk del Client Component lazy se carga al montar el botón.
5. **`/conversations/<post-baseline>`**:
   - [ ] `ThreadHeaderBar` con BackButton + kebab admin (si aplica) se pinta inmediato.
   - [ ] Click BackButton → vuelve a `/conversations` con scroll preservado.
6. **`/library/[categorySlug]`** (paranoia):
   - [ ] Visualmente IDÉNTICO a pre-B.3 (no usa `PostList`).
7. **DevTools Network panel**:
   - [ ] First Load JS `/conversations` ≤295 kB (baseline 290 kB).
   - [ ] No hay 404 en chunks lazy.
   - [ ] No hay warnings de hydration en console.

### 4.4 Bundle comparison vs baseline

Baseline pre-B.3 (capturado por el plan padre § 7.6):

```
/conversations: 290 kB
/library/[categorySlug]: 295 kB
/conversations/[postSlug]: 292 kB
/library/[categorySlug]/[itemSlug]: 295 kB
```

**Tolerancia:** ±5 kB. Si cualquier page sube >5 kB, **revert obligatorio del sub-commit** que lo causó.

**Comando:**

```bash
ANALYZE=true pnpm build 2>&1 | tee /tmp/build-post-b3.log
# Abrir .next/analyze/client.html y comparar visualmente con baseline.
```

---

## 5. Riesgos identificados

| #   | Riesgo                                                                                                                                         | Probabilidad | Impacto | Mitigación                                                                                                                                                                      |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | El re-cableado de `PostList` en B.3.2 reorganiza chunks de webpack y `/conversations` infla >5 kB                                              | media        | alto    | `ANALYZE=true pnpm build` antes/después de B.3.2. Aceptar Δ ±5 kB; revert si >+5 kB.                                                                                            |
| 2   | El sub-slice tiene divergencia funcional con el legacy en `PostList` o helpers (no asumir byte-idéntico)                                       | baja         | alto    | Diff verificado pre-B.3.4 archivo por archivo. Solo difieren paths (auditoría 0.2). Pre-gate de B.3.4 re-corre el diff.                                                         |
| 3   | Tests legacy cubren casos que el sub-slice no cubre (drift de cobertura)                                                                       | baja         | medio   | Diff de `thread-filter-pills.test.tsx` confirmó byte-idéntico. No hay otros tests legacy thread-related en `discussions/__tests__/`.                                            |
| 4   | Bundle del shell home gated `/conversations` rompe por dependencia transitiva oculta (ej: lazy import roto)                                    | baja         | alto    | Smoke manual + Network tab + ANALYZE post B.3.2 y B.3.4. RLS test enforces SQL function (presence depende de eso).                                                              |
| 5   | El borrado de `featured-thread-card.tsx` y `thread-row.tsx` legacy en B.3.4 deja `reader-stack.tsx` y `post-unread-dot.tsx` muertos en el raíz | confirmado   | nulo    | B.3.5 los borra como cleanup oportunista, gate previo verifica 0 importadores externos.                                                                                         |
| 6   | Otra sesión paralela toca thread UI mientras B.3 está en limbo (entre B.3.1 y B.3.5)                                                           | baja         | medio   | Cerrar B.3.1 → B.3.5 en sesiones consecutivas; máximo 2 días gap. Mantener `featured-thread-card.tsx`/`thread-row.tsx` legacy actualizado si hay cambios externos.              |
| 7   | `loadMorePostsAction` cross-sub-slice path absoluto rompe si el action se mueve en B.4                                                         | baja         | bajo    | El path absoluto `@/features/discussions/server/actions/load-more` es estable. Cuando B.4 lo mueva, actualizar `threads/ui/load-more-posts.tsx` (1 línea). Documentado como F2. |
| 8   | `friendlyErrorMessage` cross-sub-slice path absoluto rompe si se mueve a `shared/`                                                             | baja         | bajo    | Mismo patrón ya usado por presence/, comments/, reactions/, moderation/. Cambio futuro = update mecánico de N callers.                                                          |
| 9   | `check-slice-size.ts` sigue rojo en `discussions` raíz post-B.3                                                                                | confirmado   | bajo    | Mencionar en commit message de C: "discussions raíz baja 6176→5576, sigue en violación, deuda B.4/B.5".                                                                         |
| 10  | E2E `post-crud.spec.ts` rompe (test asume "post baseline" visible en `/conversations`)                                                         | baja         | medio   | Pre-flight: correr `pnpm playwright test tests/e2e/flows/post-crud.spec.ts` localmente antes de cada sub-commit.                                                                |
| 11  | El smoke manual omite un caso crítico (paginación + filter combinado) y bug pasa a prod                                                        | media        | alto    | Checklist § 4.3 explícita. NO mergear si algún ítem falla.                                                                                                                      |
| 12  | RLS de `markPostReadAction` falla durante smoke manual (presence interactúa con threads list para `lastReadAt`)                                | baja         | medio   | RLS test `tests/rls/post-read.test.ts` corre en CI. Smoke manual: confirmar que el dot unread baja al re-visitar un post.                                                       |

---

## 6. Test plan integral cierre del refactor

### 6.1 Comandos automáticos

```bash
# Suite completa
pnpm typecheck
pnpm lint
pnpm vitest run
pnpm test --run tests/boundaries.test.ts
pnpm test --run tests/rls/post-read.test.ts
pnpm test --run tests/rls/helpers-realtime.test.ts

# Bundle
ANALYZE=true pnpm build

# Slice size
pnpm tsx scripts/lint/check-slice-size.ts
# Esperado: discussions raíz 5576 LOC; threads 531 LOC; presence 872 LOC

# E2E
pnpm playwright test tests/e2e/flows/post-crud.spec.ts
pnpm playwright test tests/e2e/flows/zone-swipe.spec.ts
pnpm playwright test tests/e2e/flows/comment-reactions.spec.ts
```

### 6.2 Verificaciones grep

```bash
# Ningún caller externo importa el legacy thread UI
grep -rn "ui/post-list\|ui/featured-thread-card\|ui/thread-row\|ui/empty-threads\|ui/thread-filter-pills\|ui/thread-header-bar\|ui/threads-section-header\|ui/load-more-posts\|ui/reader-stack\|ui/post-unread-dot" src tests | grep -v "discussions/threads/" | grep -v "discussions/presence/"
# Esperado: solo comentarios/refs textuales, no imports

# Sub-slice threads no se importa externo (regla canónica)
grep -rn "from '@/features/discussions/threads/" src tests | grep -v "discussions/"
# Esperado: 0

# Boundary rules respetadas
pnpm test --run tests/boundaries.test.ts
# Esperado: pasa
```

### 6.3 Smoke checklist manual final (post-todos los sub-commits)

Ver § 4.3 — la checklist de B.3.4 cubre el cierre.

### 6.4 Comparación de bundle vs baseline

Ver § 4.4. Tolerancia ±5 kB. Si excede, revert.

---

## 7. Cronograma estimado

| Sub-fase                         | Trabajo                                                   | Estimado                          |
| -------------------------------- | --------------------------------------------------------- | --------------------------------- |
| Pre-flight                       | Auditoría con greps + diff + baseline `ANALYZE`           | 20 min                            |
| B.3.1                            | Re-wire `public.ts` (`ThreadHeaderBar`) + smoke           | 15 min                            |
| B.3.2                            | Re-wire `public.server.ts` (`PostList`) + smoke + ANALYZE | 30 min                            |
| Push + preview B.3.1+B.3.2       |                                                           | 15 min                            |
| B.3.3                            | Borrar test legacy + thread-header-bar legacy             | 10 min                            |
| B.3.4                            | Borrar 7 archivos legacy thread + smoke + ANALYZE         | 35 min                            |
| B.3.5                            | Cleanup oportunista reader-stack + post-unread-dot        | 10 min                            |
| Push + preview B.3.3+B.3.4+B.3.5 |                                                           | 15 min                            |
| C                                | 5 superficies de docs                                     | 25 min                            |
| Push + final preview             |                                                           | 10 min                            |
| **Total**                        |                                                           | **~3h, splittable en 2 sesiones** |

**Sesión sugerida:**

- **Sesión 1** (1.5h): Pre-flight + B.3.1 + B.3.2 + push + preview smoke. Si verde, mergear.
- **Sesión 2** (1.5h): B.3.3 + B.3.4 + B.3.5 + push + preview smoke + C + final smoke. Si verde, mergear.

Ventana entre sesiones puede ser 1-2 días sin riesgo (B.3.1 + B.3.2 son no-op semántico). Riesgo de drift se controla con vigilancia activa de cualquier PR paralelo que toque `discussions/ui/featured-thread-card.tsx`, `thread-row.tsx`, etc.

---

## 8. Apéndice — Asumidos y gaps

### 8.1 Asumidos verificados empíricamente

- ✅ Sub-slice `threads/` existe con `public.ts` exportando 7 nombres, **CERO consumers externos**. Verificado con `grep -rn "from '@/features/discussions/threads/" src tests | grep -v "discussions/"` → 0 hits.
- ✅ Diff de los 8 archivos UI: solo paths de imports difieren (sin drift de lógica). Verificado con `diff` archivo por archivo.
- ✅ Test legacy `thread-filter-pills.test.tsx` byte-idéntico al sub-slice. Verificado con `diff` (sin output).
- ✅ `/library/[categorySlug]/page.tsx` NO usa `PostList` — usa `ItemList` desde `library/public`. Solo `/conversations` usa `PostList`.
- ✅ LOC actual `discussions` raíz: 6176. Verificado con `pnpm tsx scripts/lint/check-slice-size.ts`.
- ✅ El sub-slice `threads/` importa `ReaderStack`/`PostUnreadDot` desde `presence/public` (cross-sub-slice por path absoluto), patrón ya validado por sibling sub-slices.
- ✅ `friendlyErrorMessage` en `discussions/ui/utils.ts` se importa cross-sub-slice por path absoluto desde `presence/`, `comments/`, `reactions/`, `moderation/`, `threads/` — patrón canónico.
- ✅ `loadMorePostsAction` vive en `discussions/server/actions/load-more.ts` legacy y no migra en B.3 (es B.4). El sub-slice `threads/` lo importa por path absoluto.
- ✅ Boundaries test `tests/boundaries.test.ts` permite cross-sub-slice via `<sub>/public` o `<sub>/public.server` (ADR `2026-05-08-sub-slice-cross-public.md`). El re-wire de `public.{ts,server.ts}` a `./threads/public` cumple con esa regla.

### 8.2 Asumidos NO verificados (riesgo asumido)

- **Bundle baseline `/conversations: 290 kB`** se cita del plan padre § 7.6. Este plan asume que ese baseline sigue vigente al momento de iniciar B.3. **Pre-flight obligatorio:** capturar `ANALYZE=true pnpm build` actual y registrar el número exacto antes de iniciar B.3.2.
- **El cap LOC `1500` para sub-slices.** El script default es 1500. `discussions/threads` post-B.3 = 531 (queda con +969 de headroom — sin riesgo).
- **Que el sub-slice `threads/` tiene el comportamiento idéntico al legacy en preview deploy.** Solo se verificó por `diff`. La realidad runtime puede diferir si webpack reordena algo. **Mitigación:** smoke manual obligatorio post-B.3.2.
- **Que ningún PR paralelo toca thread UI durante el limbo entre B.3.1 y B.3.5.** Recomendación: vigilar git log antes de cada sub-commit y resolver drift si aparece.

### 8.3 Gaps identificados (auditoría in-situ adicional recomendada)

- **Drift dinámico durante el merge ventana**: si entre la auditoría 2026-05-09 y la ejecución de B.3 hay >7 días de gap, re-correr todos los `diff` y `grep` del § 0 para confirmar que nada cambió. Sub-slices duplicados son frágiles a cambios paralelos.
- **WHITELIST del slice-size script**: actualmente vacío. El raíz `discussions` falla el script con exit 1 hoy. Decisión pendiente del owner: ¿re-poblar la WHITELIST con `discussions` (cap mayor, ADR 2026-04-20) hasta que B.4/B.5 cierren? Esa decisión es ortogonal a B.3 pero impacta CI status.
- **Test E2E `post-crud.spec.ts:30`** chequea `getByText(/Post baseline Palermo/)` — depende de que `PostList` SSR renderice el post baseline. Si B.3.2 rompe el SSR, el E2E falla (señal limpia).
- **Tests RLS `tests/rls/post-read.test.ts`** y `tests/rls/helpers-realtime.test.ts` cubren presence pero NO cubren el SSR de `PostList`. La cobertura del SSR descansa solamente en smoke manual + E2E. Aceptar riesgo o sumar test (out of scope B.3).

### 8.4 Lo que NO sé

- **Comportamiento exacto del bundle splitter de Next 15** ante el rewire de `PostList`. Es plausible (no demostrado) que el chunk del SSR se mantenga idéntico porque los archivos del sub-slice son los mismos a nivel de bytes excepto los paths. **Riesgo cuantificado en 5 kB de tolerancia.**
- **Si Vercel preview deployments lanzados rápidamente uno tras otro pueden cachear el chunk anterior y servir mixto.** Recomendación: esperar 30s entre deploys y refrescar con cache disabled (DevTools → Network → "Disable cache").
- **Si hay alguna page del shell streamed (`_thread-content.tsx`, `_comments-section.tsx`) que pre-fetchee `PostList` indirectamente.** Verifiqué con grep: solo `app/[placeSlug]/(gated)/conversations/page.tsx` lo usa. Pero el grep no captura imports indirectos via barrel re-export — la confianza viene del flow estático verificado.

---

### Critical Files for Implementation

- `/Users/maxi/claude-workspace/place/src/features/discussions/public.ts`
- `/Users/maxi/claude-workspace/place/src/features/discussions/public.server.ts`
- `/Users/maxi/claude-workspace/place/src/features/discussions/threads/public.ts`
- `/Users/maxi/claude-workspace/place/src/features/discussions/ui/post-list.tsx` (legacy a borrar)
- `/Users/maxi/claude-workspace/place/src/features/discussions/threads/ui/post-list.tsx` (sub-slice a preservar)
