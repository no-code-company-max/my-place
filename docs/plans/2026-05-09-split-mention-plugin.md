# Plan — Split de `mention-plugin.tsx` (830 LOC → 7 archivos ≤300)

**Estado**: listo para ejecutar (este sesión).
**Origen**: Audit #407 generado por Plan agent + auditoría posterior con 6 ajustes integrados.
**Pre-conditions verificadas** (2026-05-09):

- LOC actual: **830** (post-commit `2b33a23`, registry SLASH_COMMANDS).
- Cycle check: `grep "mention-plugin" mention-node.tsx` = 0 hits ✓
- `useStableResolvers` confirmado dead code (cero consumers en `src/`/`tests/`).
- Tests del slice con imports internos:
  - `__tests__/mention-feedback-menu.test.tsx` (preexistente).
  - `__tests__/match-slash-command.test.ts` (nuevo, post-#10).

---

## Objetivo

Dividir `src/features/rich-text/mentions/ui/mention-plugin.tsx` (830 LOC, cap 300) en 7 archivos ≤300 LOC sin cambio funcional, manteniendo intacta la superficie pública del slice y los paths que importan los tests internos.

**No-goals**: renombrar tipos, cambiar firmas exportadas en `public.ts`, mover `mention-node.tsx` ni `mention-prefetch-context.tsx`, alterar comportamiento runtime (incluido orden de `useEffect`, deps, telemetría `console.warn`, slowTimer 5s).

---

## Inventario actual del archivo (830 LOC)

| Sección                                                                            | Rango aprox. | LOC | Tipo                   |
| ---------------------------------------------------------------------------------- | ------------ | --- | ---------------------- |
| A. `'use client'` + imports                                                        | 1-14         | 14  | infra                  |
| B. Tipos resolver (User/Event/LibraryCategory/LibraryItem)                         | 20-42        | 23  | types pub              |
| C. Tipos `MentionResolversForEditor` legacy + `ComposerMentionResolvers`           | 44-64        | 21  | types pub              |
| D. `Trigger` union (4 kinds)                                                       | 70-74        | 5   | types int              |
| E. Constantes `MAX_RESULTS`, `SLOW_THRESHOLD_MS` + comentarios                     | 76-83        | 8   | const int              |
| F. `class GenericMenuOption` + `MenuPayload` discriminated                         | 85-106       | 22  | clase int              |
| G. **`MentionPlugin`** (state machine, 3 useEffects, triggerFn, render)            | 122-432      | 311 | componente principal   |
| H. `MentionMenu` (renderer de listbox)                                             | 438-475      | 38  | comp UI                |
| I. `MentionFeedbackMenu` (loading/error/slow)                                      | 485-545      | 61  | comp UI                |
| J. `MentionRow` (per-item por kind)                                                | 547-583      | 37  | comp UI                |
| K. `SLASH_RE` + `SlashMatch` + **`SLASH_COMMANDS` registry** + `matchSlashCommand` | 589-686      | 98  | helper puro (post-#10) |
| L. `Caches` type + `trySyncFromCache` + `filterByQuery`                            | 692-741      | 50  | helpers puros          |
| M. `fetchOptionsForTrigger`                                                        | 743-784      | 42  | helper async           |
| N. `buildMentionFromPayload`                                                       | 786-825      | 40  | helper                 |
| O. `useStableResolvers` (dead code, 0 consumers)                                   | 826-830      | 5   | hook muerto            |

---

## Split propuesto — 7 archivos

Todos paths absolutos. `'use client'` solo en archivos con componentes React.

### 1. `src/features/rich-text/mentions/ui/mention-types.ts` (~75 LOC)

- **Sin** `'use client'` (pure types).
- Exporta: `MentionUserResult`, `MentionEventResult`, `MentionLibraryCategoryResult`, `MentionLibraryItemResult`, `MentionResolversForEditor`, `ComposerMentionResolvers`, `Trigger`, `MenuPayload`.

### 2. `src/features/rich-text/mentions/ui/menu-option.ts` (~25 LOC)

- **Sin** `'use client'`.
- Exporta: `class GenericMenuOption extends MenuOption` + `const MAX_RESULTS = 8`.
- `SLOW_THRESHOLD_MS` se queda en `mention-plugin.tsx` (sólo lo usa el setTimeout interno).

### 3. `src/features/rich-text/mentions/ui/trigger-detection.ts` (~115 LOC, **actualizado post-#10**)

- **Sin** `'use client'` (puro).
- Exporta: `SLASH_RE`, type `SlashMatch`, type `SlashCommand` (nuevo), `SLASH_COMMANDS` registry, `matchSlashCommand`.
- Imports: `Trigger` desde `./mention-types`.

### 4. `src/features/rich-text/mentions/ui/mention-cache.ts` (~120 LOC)

- **Sin** `'use client'`.
- Exporta: type `Caches`, `trySyncFromCache`, `filterByQuery`, `fetchOptionsForTrigger`, `buildMentionFromPayload`.
- Imports: types desde `./mention-types`, `GenericMenuOption` desde `./menu-option`, `$createMentionNode` desde `./mention-node`.

### 5. `src/features/rich-text/mentions/ui/mention-feedback-menu.tsx` (~85 LOC)

- `'use client'`.
- Exporta `MentionFeedbackMenu`. Resuelve el code smell del "exportado sólo para tests".
- Imports: `Trigger` desde `./mention-types`, React.

### 6. `src/features/rich-text/mentions/ui/mention-menu.tsx` (~85 LOC)

- `'use client'`.
- Exporta `MentionMenu` + co-localiza `MentionRow` (no exportado).
- Imports: `GenericMenuOption` desde `./menu-option`, `MenuPayload` desde `./mention-types`, React.

### 7. `src/features/rich-text/mentions/ui/mention-plugin.tsx` (~250 LOC, **queda**)

- `'use client'`.
- Mantiene: `MentionPlugin` (orquestación + state + 3 useEffects + triggerFn + onSelectOption + render), `SLOW_THRESHOLD_MS`.
- **Re-exporta types** para no romper `public.ts` ni `mention-prefetch-context.tsx` ni tests del slice composers.
- Imports: `MentionMenu`, `MentionFeedbackMenu`, `matchSlashCommand`, `trySyncFromCache`/`fetchOptionsForTrigger`/`buildMentionFromPayload`, `GenericMenuOption`/`MAX_RESULTS`, `Trigger`.

**LOC total**: 75 + 25 + 115 + 120 + 85 + 85 + 250 ≈ 755. Bajamos de 830 monolítico a 7 archivos, todos ≤300.

---

## Mapping de imports (sin ciclos)

```
mention-types.ts            (puro, hoja)
   ↑
   ├── menu-option.ts
   │      ↑
   ├── trigger-detection.ts
   │
   ├── mention-cache.ts ← menu-option.ts, mention-node.tsx
   │
   ├── mention-feedback-menu.tsx
   │
   ├── mention-menu.tsx ← menu-option.ts
   │
   └── mention-plugin.tsx ← (todos los anteriores) + mention-prefetch-context + mention-node

mention-prefetch-context.tsx ← mention-types.ts (cambio en Step 2)
```

**Pre-check de ciclo verificado**: `mention-node.tsx` no importa de `mention-plugin.tsx` (0 hits).

---

## Updates en `public.ts`

`src/features/rich-text/mentions/public.ts` actual re-exporta `MentionPlugin` + 6 types desde `./ui/mention-plugin`.

**Step 1-3**: cero cambio. `mention-plugin.tsx` mantiene re-exports de compat.
**Step 4 (opcional)**: actualizar `public.ts` para importar types directo desde `./ui/mention-types` y retirar los re-exports de compat. Limpia indirection.

---

## Updates en tests

**`__tests__/mention-feedback-menu.test.tsx`** (Step 4)

- Cambia: `import { MentionFeedbackMenu } from '../ui/mention-plugin'`
- Por: `import { MentionFeedbackMenu } from '../ui/mention-feedback-menu'`

**`__tests__/match-slash-command.test.ts`** (Step 4 — **AÑADIDO post-#10, no estaba en plan original**)

- Cambia: `import { matchSlashCommand } from '../ui/mention-plugin'`
- Por: `import { matchSlashCommand, type SlashMatch } from '../ui/trigger-detection'`

**`__tests__/mention-prefetch-context.test.tsx`**

- No cambia (no importa de `mention-plugin.tsx`).

---

## Verificación de callers externos

Resultado de `grep -rn "from.*rich-text/mentions"` (todos via `public.ts` — boundary-clean):

| Archivo                                                              | Importa                                                 | ¿Rompe?           |
| -------------------------------------------------------------------- | ------------------------------------------------------- | ----------------- |
| `rich-text/composers/ui/base-composer.tsx`                           | `MentionPlugin`, types                                  | No (re-export OK) |
| `rich-text/composers/ui/comment-composer.tsx`                        | `MentionUserResult`                                     | No                |
| `rich-text/composers/ui/post-composer.tsx`                           | `ComposerMentionResolvers`                              | No                |
| `rich-text/composers/ui/event-composer.tsx`                          | `ComposerMentionResolvers`                              | No                |
| `rich-text/composers/ui/library-item-composer.tsx`                   | `ComposerMentionResolvers`                              | No                |
| `rich-text/composers/__tests__/post-composer.test.tsx`               | `ComposerMentionResolvers`                              | No                |
| `rich-text/composers/__tests__/event-composer.test.tsx`              | `ComposerMentionResolvers`                              | No                |
| `rich-text/composers/__tests__/library-item-composer.test.tsx`       | `ComposerMentionResolvers`                              | No                |
| `discussions/composers/mention-prefetch-provider.tsx`                | `MentionPrefetchContext`, `MentionPrefetchValue`, types | No                |
| `discussions/composers/__tests__/mention-prefetch-provider.test.tsx` | `useMentionPrefetchSource`                              | No                |

Cero updates fuera del slice. `tests/boundaries.test.ts` queda verde sin cambios.

---

## Orden de ejecución (5 commits)

### Step 0 — Prep (commit 1)

**Goal**: limpieza pre-split. Reduce ruido + valida pre-conditions.

1. Kill `useStableResolvers` (líneas 826-830). Cero consumers, cero riesgo.
2. Verificación: `grep -rn "useStableResolvers" src/ tests/` = 0 hits post-deletion.
3. `pnpm typecheck && pnpm lint && pnpm vitest run src/features/rich-text src/features/discussions` verde.
4. Commit: `chore(mention): kill useStableResolvers (dead code, 0 consumers)`.

### Step 1 — Extraer hojas puras (commit 2)

**Goal**: crear los 4 archivos puros + actualizar `mention-plugin.tsx` a importar de ellos.

1. Crear `mention-types.ts` (sección B+C+D + `MenuPayload` de F).
2. Crear `menu-option.ts` (`GenericMenuOption` + `MAX_RESULTS`).
3. Crear `trigger-detection.ts` (sección K completa: SLASH_RE + SlashMatch + SlashCommand + SLASH_COMMANDS + matchSlashCommand).
4. Crear `mention-cache.ts` (secciones L+M+N).
5. En `mention-plugin.tsx`: borrar las definiciones movidas, agregar imports de los nuevos archivos, **agregar `export type {...} from './mention-types'`** para mantener compat con `public.ts` y tests.
6. `pnpm typecheck && pnpm lint && pnpm vitest run` verde (incluyendo `mention-feedback-menu.test.tsx` y `match-slash-command.test.ts` que **siguen importando de `mention-plugin.tsx`** vía re-export).
7. **`wc -l` checkpoint**: `mention-plugin.tsx` debe estar ~520 LOC (intermedio, todavía sobre cap pero <600).
8. Commit: `refactor(mention): extraer types + cache + trigger-detection a archivos propios`.

### Step 2 — Reapuntar `mention-prefetch-context.tsx` (commit 3)

**Goal**: cleanup del import del context.

1. En `mention-prefetch-context.tsx`: cambiar `import type {...} from './mention-plugin'` → `import type {...} from './mention-types'`.
2. `pnpm typecheck && pnpm vitest run src/features/rich-text/mentions src/features/discussions/composers` verde.
3. Commit: `refactor(mention): mention-prefetch-context importa types desde mention-types`.

### Step 3 — Extraer presentacionales (commit 4)

**Goal**: extraer los 2 componentes UI restantes.

1. Crear `mention-feedback-menu.tsx` (sección I, copia íntegra del componente + el comentario explicativo).
2. Crear `mention-menu.tsx` (secciones H+J: `MentionMenu` + `MentionRow`).
3. En `mention-plugin.tsx`: borrar las definiciones, agregar imports.
4. **CRÍTICO**: durante este step, `mention-plugin.tsx` debe mantener `export { MentionFeedbackMenu } from './mention-feedback-menu'` (re-export de compat). Sin esto, `mention-feedback-menu.test.tsx` rompe — el path se actualiza recién en Step 4.
5. `pnpm typecheck && pnpm lint && pnpm vitest run` verde.
6. **`wc -l` checkpoint**: `mention-plugin.tsx` debe caer a ~250 LOC (bajo el cap).
7. Commit: `refactor(mention): extraer MentionMenu + MentionFeedbackMenu a archivos propios`.

### Step 4 — Actualizar tests + retirar compat (commit 5)

**Goal**: finalizar limpieza.

1. Actualizar `__tests__/mention-feedback-menu.test.tsx`: path → `'../ui/mention-feedback-menu'`.
2. Actualizar `__tests__/match-slash-command.test.ts`: path → `'../ui/trigger-detection'` (incluyendo type import si aplica).
3. Retirar `export { MentionFeedbackMenu }` y `export { matchSlashCommand, type SlashMatch }` de `mention-plugin.tsx`.
4. Retirar comentarios `/** Exportado SÓLO para tests */` que ya no aplican.
5. (Opcional) Actualizar `public.ts` para importar types desde `./ui/mention-types` directo y retirar los re-exports de compat de `mention-plugin.tsx`.
6. **`wc -l` final**: `wc -l src/features/rich-text/mentions/ui/*.{ts,tsx}` — TODOS los archivos ≤300.
7. `pnpm typecheck && pnpm lint && pnpm vitest run && pnpm test:boundaries` verde.
8. Commit: `refactor(mention): actualizar tests y retirar re-exports de compat`.

---

## Riesgos + mitigaciones

| Riesgo                                                                          | Mitigación                                                                                                                                                                 |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HMR / Fast Refresh con `'use client'` splitting                                 | Archivos `.ts` puros no llevan directiva — Next 15 los traza correctamente bajo el grafo cliente cuando `mention-plugin.tsx` los importa. Patrón ya usado en `composers/`. |
| Ciclos de imports                                                               | Pre-check de Step 0 verificó `mention-node` no importa de `mention-plugin`. Grafo one-way confirmado.                                                                      |
| `mention-feedback-menu.test.tsx` con dos paths válidos durante Step 3           | Step 4 actualiza path **y** retira re-export en el mismo commit. Si se separa, el test rompe.                                                                              |
| `match-slash-command.test.ts` (nuevo post-#10) olvidado en Step 4               | **Listado explícito** en Step 4 paso 2. Plan original NO lo incluía — gap cerrado.                                                                                         |
| Telemetría `console.warn` en fetch effect movida a `mention-cache.ts` por error | Plan explícito: el log queda en `mention-plugin.tsx` porque captura scope del componente. NO mover.                                                                        |
| Bundle size aumenta por overhead de módulos                                     | **Done criteria 4** captura `next build` antes/después. Si First Load JS sube >2kB, investigar antes de mergear.                                                           |
| `useStableResolvers` arrastrado                                                 | **Step 0 lo elimina** antes del split. Plan original lo preservaba.                                                                                                        |
| Boundary test `tests/boundaries.test.ts` falla                                  | El test audita imports cross-feature. Todos los imports nuevos son intra-slice. Se valida en Step 4.                                                                       |
| Step intermedio falla, repo queda en estado inconsistente                       | **Cada step es 1 commit**. Si Step N rompe, `git revert HEAD` restaura. Step 0 es el checkpoint inicial.                                                                   |

---

## Criterios de done

1. `pnpm typecheck` verde sin nuevos errores.
2. `pnpm lint` verde sin warnings nuevos.
3. `pnpm vitest run` verde, especialmente:
   - `__tests__/mention-feedback-menu.test.tsx` (path actualizado)
   - `__tests__/match-slash-command.test.ts` (path actualizado)
   - `__tests__/mention-prefetch-context.test.tsx`
   - `composers/__tests__/*.test.tsx` (4 composer tests del slice rich-text)
   - `discussions/composers/__tests__/mention-prefetch-provider.test.tsx`
   - `tests/boundaries.test.ts`
4. `pnpm build` verde **+ comparación de chunks**:
   - Antes del split: `pnpm build 2>&1 | grep -E "/conversations/(new|\\[postSlug\\])"` → capturar First Load JS.
   - Después del split: idem.
   - Diff esperado: ≤ ±2kB (overhead de módulos vs dedup).
5. **`wc -l src/features/rich-text/mentions/ui/*.{ts,tsx}`** — output esperado: TODOS los archivos ≤300 LOC.
6. `grep -rn "useStableResolvers" src/ tests/` = **0 hits** (eliminado en Step 0).
7. API pública del slice (`mentions/public.ts`) sin cambio breaking — verificable con `git diff public.ts` (sólo cambios de path interno o vacío).
8. Cero cambio funcional: `git diff` no debe alterar runtime (mismas regex, mismos timeouts, mismos `useEffect` deps, mismo telemetry log, mismo orden de `setOptions/setLoading`).

---

## Rollback plan

Si cualquier step falla post-commit y no se puede arreglar en el momento:

- `git revert <hash-del-step>` restaura al estado verde anterior.
- Cada commit es atómico — revert no rompe los anteriores.
- Si la cadena se complica, `git reset --hard <hash-de-Step-0>` restaura al inicio del split.

---

## Critical files

- `/Users/maxi/claude-workspace/place/src/features/rich-text/mentions/ui/mention-plugin.tsx` (modify)
- `/Users/maxi/claude-workspace/place/src/features/rich-text/mentions/ui/mention-types.ts` (NEW)
- `/Users/maxi/claude-workspace/place/src/features/rich-text/mentions/ui/menu-option.ts` (NEW)
- `/Users/maxi/claude-workspace/place/src/features/rich-text/mentions/ui/trigger-detection.ts` (NEW)
- `/Users/maxi/claude-workspace/place/src/features/rich-text/mentions/ui/mention-cache.ts` (NEW)
- `/Users/maxi/claude-workspace/place/src/features/rich-text/mentions/ui/mention-feedback-menu.tsx` (NEW)
- `/Users/maxi/claude-workspace/place/src/features/rich-text/mentions/ui/mention-menu.tsx` (NEW)
- `/Users/maxi/claude-workspace/place/src/features/rich-text/mentions/ui/mention-prefetch-context.tsx` (modify, Step 2)
- `/Users/maxi/claude-workspace/place/src/features/rich-text/mentions/public.ts` (modify opcional, Step 4)
- `/Users/maxi/claude-workspace/place/src/features/rich-text/mentions/__tests__/mention-feedback-menu.test.tsx` (modify, Step 4)
- `/Users/maxi/claude-workspace/place/src/features/rich-text/mentions/__tests__/match-slash-command.test.ts` (modify, Step 4)
