# Plan — Sub-split de `library/` raíz + CI cap enforcement

**Fecha:** 2026-05-04
**Owner:** Lead — sequential por fases (cada fase = 1 sesión).
**Spec:** `docs/features/library/spec.md` (update en S.5).
**ADR a redactar (S.0):** `docs/decisions/2026-05-04-library-root-sub-split.md`.
**Plan precedente:** `docs/plans/2026-05-04-library-courses-and-read-access.md` (cerrado, definió el patrón sub-slice con `access/` + `courses/`).

## Contexto

El slice `src/features/library/` raíz (sin contar los sub-slices `access/` y `courses/`) tiene **~6700 LOC prod + ~4400 LOC tests** = ~11100 LOC. El cap por feature en `CLAUDE.md` y `docs/architecture.md` es **1500 LOC**. Llegamos acá por:

- **9 commits en 6 horas (R.7.2 → R.7.10, 30-abr)** sin pausa de governance. Cruzó 1500 LOC en R.7.2 (segundo commit del slice). Continuó +4500 sin que nadie pausara.
- **El cap es doc, no CI.** No hay enforcement automático — depende de que el dev recuerde el cap entre sesiones.
- **Precedente confuso.** `discussions` tiene ADR pre-redactado (20-abr). Para `library` se asumió "es denso, vale igual" sin escribir ADR ni evaluar split.

Este plan resuelve ambos problemas:

1. **Refactor**: sub-split del raíz en 3 sub-slices nuevos (`embeds/`, `items/`, `admin/`). Raíz queda en ~1100 LOC, cada sub-slice bajo 1500. Patrón ya validado con `access/` + `courses/`.
2. **Governance**: script CI que falla si cualquier slice/sub-slice supera 1500 LOC sin estar en whitelist de excepciones documentadas. Se invoca desde `pnpm lint` para que falle en pre-commit + CI sin paso adicional.

## Decisiones cerradas

1. **3 sub-slices nuevos**, ordenados de menor a mayor coupling:
   - `library/embeds/` (~590 LOC prod) — TipTap embed extension + node-view + parser + toolbar.
   - `library/items/` (~875 LOC prod) — UI + actions de items (form, editor, header, admin-menu, ItemList wrapper, EmptyItemList, actions create/update/archive item).
   - `library/admin/` (~1610 LOC prod) — UI admin de categorías (CategoryListAdmin + form sheet + wizard 4-step + contributors sheet + groups scope sheet + archive confirm) + actions de category (create/update/archive/reorder/invite-contributor/remove-contributor/set-group-scope/set-designated-contributors).
2. **Raíz post-split (~1100 LOC prod)** queda con: `domain/{types, permissions, invariants, errors, slug}`, `schemas.ts`, `server/{viewer, queries/*, actions/shared}`, UI presentational shared (`category-card`, `category-grid`, `category-header-bar`, `empty-library`, `library-section-header`, `recents-list`, `library-item-row`, `errors.ts` movido), `public.ts`, `public.server.ts`.
3. **`LibraryItemRow` se queda en raíz**, no en `items/`. Razón: es presentational atómico sin lógica, usado tanto por `RecentsList` (raíz) como por `ItemList` (items/). Mover a items/ obligaría a raíz a importar de items/ (invierte la dependencia natural raíz←sub-slice).
4. **`friendlyLibraryErrorMessage` se mueve de `ui/admin/errors.ts` a `ui/errors.ts` (raíz)** ANTES del split. Razón: ya hoy lo consumen archivos de items/ (`library-item-form.tsx`, `item-admin-menu.tsx`) — no es admin-specific. Si lo dejamos en `admin/`, items/ tendría que importarlo via `@/features/library/admin/public` (cross-sub-slice por algo que es genérico). Mover a raíz es semánticamente correcto.
5. **`embed-parser.ts` se mueve de `domain/` a `embeds/domain/`** durante la creación de embeds/. Razón: solo lo usa el sub-slice `embeds/` (toolbar + node-view). Mantenerlo en raíz/domain expondría detalle de implementación de embeds al resto del slice.
6. **Imports relativos en actions se convierten a absolute en S.1 (pre-cleanup)**. Hoy: `from '../viewer'`, `from '../queries'`. Post-split los actions viven en `library/items/server/actions/` y `library/admin/server/actions/` — relative paths romperían. Convertir a `@/features/library/public.server` ANTES de mover los archivos. Esto exige re-exportar `resolveLibraryViewer` + queries necesarias desde `public.server.ts` (ya están exportadas, sólo verificar).
7. **Tests se mueven con su archivo bajo test** (`__tests__/` dentro de cada sub-slice). Mocks usan `@/db` y `@/shared` (globales) → safe. Mocks que usen paths internos de library se actualizan al nuevo path en la misma fase.
8. **CI cap enforcement con whitelist explícito**. Script `scripts/lint/check-slice-size.ts`:
   - Itera `src/features/<slice>/` (top-level) y sub-slices (carpetas con `public.ts` propio bajo el slice).
   - Cuenta LOC de `.ts` + `.tsx` excluyendo `__tests__/` y `*.test.ts`.
   - Compara contra cap 1500 LOC default; whitelist en mismo script (entries `{ path, maxLoc, adrPath }`).
   - Whitelist inicial: `discussions` (4800, ADR `2026-04-20-discussions-size-exception.md`).
   - Falla con código !=0 si algún slice/sub-slice supera su cap declarado.
   - Invocado desde `pnpm lint` (agregar al `lint` script en `package.json`) para que falle en pre-commit + CI sin paso nuevo.
   - **NO** es feature flag ni opcional: si querés autorizar excepción, agregás entry al whitelist + ADR. Sin ADR, no entra al whitelist.

## Sub-fases

| Sub       | Tema                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Sesiones | Deliverable                                                                                                                                                                                                                                                                                                                                                                  |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S.0**   | ADR + bootstrap. Redactar ADR del split + agregar `library/embeds`, `library/items`, `library/admin` al `SUB_SLICE_BOUNDARIES` del boundary test (lista vacía hasta que existan los directorios — el test acepta sub-slice declarado-pero-no-creado). Crear el script CI + entry de whitelist (vacía por ahora).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | 0.5      | ADR redactado. `tests/boundaries.test.ts` extendido. `scripts/lint/check-slice-size.ts` creado. `pnpm lint` invoca el check. Suite verde — el check no falla porque library raíz aún supera y NO está whitelisted, pero **agregamos entry de whitelist temporal con TODO de sub-split** (referenciando este plan), que se borra en S.5.                                      |
| **S.1**   | Pre-cleanup. Mover `friendlyLibraryErrorMessage` a `library/ui/errors.ts` raíz + actualizar 6 consumers. Convertir imports relativos en server/actions a absolute (`@/features/library/public.server`). Verificar que `public.server.ts` exporta `resolveLibraryViewer` + queries usadas por actions (sino, agregar).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | 0.5      | 6 archivos actualizados (admin/\* + items/library-item-form + items/item-admin-menu). 4 actions con imports absolute. typecheck + tests + build verde. **Sin mover archivos a sub-slices todavía.**                                                                                                                                                                          |
| **S.2**   | Crear `library/embeds/`. Mover: `domain/embed-parser.ts` → `embeds/domain/embed-parser.ts`; `ui/embed-node/{extension,node-view}` → `embeds/ui/embed-node/`; `ui/embed-toolbar.tsx` → `embeds/ui/embed-toolbar.tsx`; test `__tests__/embed-parser.test.ts` → `embeds/__tests__/embed-parser.test.ts`. Crear `embeds/public.ts` con re-exports (EmbedNodeExtension, EmbedNodeView, EmbedToolbar, parseEmbedUrl, EMBED_PROVIDERS, EmbedProvider, ParsedEmbed). Update `library/public.ts` para re-exportar de `./embeds/public`. Update `library/ui/library-item-editor.tsx` para importar de `@/features/library/embeds/public` (en vez de `./embed-node/extension`).                                                                                                                                                                                           | 1        | Sub-slice creado. Imports actualizados (3 archivos consumers internos: editor, items/library-item-form si usa embeds, etc.). Boundary test pasa. typecheck + lint + tests + build verde. CI check verifica que `embeds/` < 1500 LOC.                                                                                                                                         |
| **S.3**   | Crear `library/items/`. Mover: `ui/library-item-form.tsx`, `ui/library-item-editor.tsx`, `ui/library-item-header.tsx`, `ui/library-item-header-bar.tsx`, `ui/item-admin-menu.tsx`, `ui/item-list.tsx`, `ui/empty-item-list.tsx` → `items/ui/`. Mover server/actions/{create-item, update-item, archive-item} → `items/server/actions/`. Mover tests {create-item, update-item, archive-item, item-list} → `items/__tests__/`. Crear `items/public.ts` (UI + actions client-safe) y `items/public.server.ts` (vacío inicial — items no necesita queries propias, las del raíz alcanzan). Update `library/public.ts` para re-exportar de `./items/public`. Actualizar 6 pages consumers.                                                                                                                                                                         | 1.5      | Sub-slice creado. ItemList importa LibraryItemRow de `@/features/library/public` (cross-direction OK: sub-slice → parent). Pages (`library/[cat]/page.tsx`, `[itemSlug]/page.tsx`, `[itemSlug]/edit/page.tsx`, `library/new/page.tsx`, `[cat]/new/page.tsx`) actualizadas para importar de items/public. Boundary test pasa. Gates verde. CI check verifica `items/` < 1500. |
| **S.4**   | Crear `library/admin/`. Mover: `ui/admin/*` (todo el directorio) → `admin/ui/`. Mover server/actions/{create-category, update-category, archive-category, reorder-categories, invite-contributor, remove-contributor, set-category-group-scope, set-designated-contributors} → `admin/server/actions/`. Mover tests {create-category, update-category, archive-category, reorder-categories, invite-contributor, remove-contributor, set-category-group-scope, set-designated-contributors} → `admin/__tests__/`. Crear `admin/public.ts` (CategoryListAdmin + actions de category + contribution policy labels) y `admin/public.server.ts` (vacío inicial o con re-export de queries específicas si aparecen). Update `library/public.ts`. Actualizar `settings/library/page.tsx` + `settings/groups/[groupId]/page.tsx` (si usa categoryId-related actions). | 1.5      | Sub-slice creado (el más grande). Pages settings actualizadas. Boundary test pasa. Gates verde. CI check verifica `admin/` < 1500.                                                                                                                                                                                                                                           |
| **S.5**   | Cierre. Verificar `library/` raíz quedó < 1500 LOC. **Eliminar entry temporal de whitelist** del CI check (raíz ya cumple, no necesita excepción). Update `docs/features/library/spec.md` con el nuevo árbol (§ 10.5). Update este plan marcando ✅ cerrado + acotación de tamaños finales. Manual smoke: navegar `/library` (zona) + `/library/[cat]` (listing con + sin curso) + `/library/[cat]/[item]` (detail) + `/library/[cat]/[item]/edit` (form con prereq selector) + `/settings/library` (admin). Final greps de cero residuos: `grep -rn "@/features/library/ui/" src/` → 0 hits (post-split nadie importa deep), `grep -rn "from '\./admin/errors'" src/features/library/` → 0 hits (movido a raíz/errors).                                                                                                                                       | 0.5      | Spec + plan actualizados. Whitelist temporal removida. Smoke OK. Cero residuos. ADR cierra con métricas finales reales.                                                                                                                                                                                                                                                      |
| **Total** |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | **5.5**  |                                                                                                                                                                                                                                                                                                                                                                              |

### Patrón de validación post-fase

Cada fase termina con: `pnpm typecheck && pnpm lint && pnpm test --run && pnpm build`. Si CI check falla en cualquier fase, se diagnostica antes de avanzar — nunca pasamos al siguiente sub-slice con la lista anterior en rojo.

## Critical files

### S.0 (bootstrap)

- `tests/boundaries.test.ts` — extender `SUB_SLICE_BOUNDARIES` a `['library/access', 'library/courses', 'library/embeds', 'library/items', 'library/admin']`. El test ya acepta sub-slices declarados antes de existir físicamente (la lógica chequea archivos del propio file-tree).
- `scripts/lint/check-slice-size.ts` — **NUEVO**. Script TS:
  - `walkSlices(rootDir)` retorna `[{ path, locProd, locTest }]` para cada `src/features/<slice>/` y cada sub-carpeta con `public.ts` propio bajo el slice.
  - Compara contra `WHITELIST` array `[{ path, maxLoc, adrPath }]` o cap default 1500.
  - `process.exit(1)` con report claro (path violador, LOC actual, cap declarado, ADR si está whitelisted) cuando viola.
  - Excluye `__tests__/`, `**/*.test.ts`, `**/*.test.tsx` del cómputo.
- `package.json` — `"lint": "eslint . && tsx scripts/lint/check-slice-size.ts"` (composición — eslint primero, después size check).
- `docs/decisions/2026-05-04-library-root-sub-split.md` — **NUEVO ADR**. Documenta: el split (3 sub-slices), la decisión sobre `LibraryItemRow` y `friendlyLibraryErrorMessage` quedando en raíz, el orden secuencial de extracción, y el rationale del CI check. Incluye métricas pre/post-split en sección "Verificación".

### S.1 (pre-cleanup)

- `src/features/library/ui/errors.ts` — **NUEVO** (movido de `ui/admin/errors.ts`). Mismo contenido, header doc actualizado.
- `src/features/library/ui/admin/errors.ts` — **ELIMINADO** (su contenido quedó en raíz/errors.ts).
- `src/features/library/public.ts` — actualizar re-export: `from './ui/errors'` (en vez de `./ui/admin/errors`).
- 6 consumers (`library-item-form.tsx`, `item-admin-menu.tsx`, `contributors-sheet.tsx`, `groups-scope-sheet.tsx`, `archive-category-confirm.tsx`, `category-form-sheet.tsx`) — actualizar import a `'../errors'` o `'../../errors'` según profundidad.
- 4 actions con imports relativos (`archive-item.ts`, `create-item.ts`, `update-item.ts`, posibles otros) — convertir `'../viewer'`/`'../queries'` a `'@/features/library/public.server'`.
- `src/features/library/public.server.ts` — verificar que exporta `resolveLibraryViewer`, `listCategoryContributorUserIds`, `listLibraryCategories` (ya lo hace, validar). Si falta algo usado por actions, agregar.

### S.2 (embeds/)

- **NUEVO directorio**: `src/features/library/embeds/{public.ts, domain/embed-parser.ts, ui/embed-node/{extension.ts, node-view.tsx}, ui/embed-toolbar.tsx, __tests__/embed-parser.test.ts}`.
- `src/features/library/public.ts` — drop exports directos de embed components, re-exportar de `./embeds/public`.
- `src/features/library/ui/library-item-editor.tsx` (si queda en raíz hasta S.3) — actualizar import a `@/features/library/embeds/public`.

### S.3 (items/)

- **NUEVO directorio**: `src/features/library/items/{public.ts, public.server.ts, ui/{library-item-form.tsx, library-item-editor.tsx, library-item-header.tsx, library-item-header-bar.tsx, item-admin-menu.tsx, item-list.tsx, empty-item-list.tsx}, server/actions/{create-item.ts, update-item.ts, archive-item.ts}, __tests__/{create-item.test.ts, update-item.test.ts, archive-item.test.ts, item-list.test.tsx}}`.
- `src/features/library/public.ts` — drop exports de items, re-exportar de `./items/public`.
- 6 pages: `(gated)/library/page.tsx`, `(gated)/library/[categorySlug]/page.tsx`, `(gated)/library/[categorySlug]/[itemSlug]/page.tsx`, `(gated)/library/[categorySlug]/[itemSlug]/edit/page.tsx`, `(gated)/library/new/page.tsx`, `(gated)/library/[categorySlug]/new/page.tsx` — actualizar imports a `@/features/library/items/public` (UI/actions de items) + mantener `@/features/library/public(.server)` para tipos del dominio + queries del raíz.

### S.4 (admin/)

- **NUEVO directorio**: `src/features/library/admin/{public.ts, ui/{category-list-admin.tsx, category-form-sheet.tsx, contributors-sheet.tsx, groups-scope-sheet.tsx, archive-category-confirm.tsx, contribution-policy-label.tsx, wizard/*.tsx}, server/actions/{create-category.ts, update-category.ts, archive-category.ts, reorder-categories.ts, invite-contributor.ts, remove-contributor.ts, set-category-group-scope.ts, set-designated-contributors.ts}, __tests__/{...8 test files de category actions}}`.
- `src/features/library/public.ts` — drop exports de admin, re-exportar de `./admin/public`.
- 1 page: `settings/library/page.tsx` — actualizar import de `CategoryListAdmin` a `@/features/library/admin/public`.

### S.5 (cierre)

- `scripts/lint/check-slice-size.ts` WHITELIST — eliminar entry temporal de `library` raíz (debería estar < 1500 sin necesidad de excepción).
- `docs/features/library/spec.md` § 10.5 — actualizar tree con los 3 sub-slices nuevos + cap por sub-slice + nota del CI check.
- Este plan — marcar ✅ + sumar tabla "Métricas finales" con LOC reales por sub-slice.

## Helpers / patterns reusados

- **Patrón sub-slice**: ya validado por `library/access/` + `library/courses/`. Cada sub-slice tiene `public.ts` (cliente-safe) + opcionalmente `public.server.ts` (con `import 'server-only'`). Boundary test enforce que sólo se importa via public(.server).
- **Discriminated union returns** en server actions: ya en place (gotcha CLAUDE.md). No se cambia.
- **Re-export pattern del raíz public**: `library/public.ts` re-exporta selectivamente de cada sub-slice para que consumers que prefieran un import único sigan funcionando. Pages que ya saben en qué sub-slice vive cada cosa importan directo del sub-slice (más explícito).
- **CI check** sigue el mismo formato que tests existentes (`tests/boundaries.test.ts`): hardcoded list, falla con mensaje claro, fácil de auditar diff. NO es config externa ni feature flag.

## Riesgos + mitigaciones

| Riesgo                                                                                                                                                      | Severity | Mitigación                                                                                                                                                                                                                                                                                |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **CRÍTICO**: Mover `friendlyLibraryErrorMessage` rompe 6 consumers si update no es atómico.                                                                 | 🔴       | S.1 mueve archivo + actualiza 6 imports en el mismo commit. Gates post-S.1 antes de S.2. Sin red intermediario.                                                                                                                                                                           |
| **CRÍTICO**: Pages que mezclan items + admin + access + courses tras el split tienen 4-5 import statements. Pérdida de claridad.                            | 🟠       | Aceptable trade-off — los imports explícitos son **más auditables** que un import único masivo. Convención: agrupar imports por sub-slice (un import por cluster, ordenados alfabéticamente por path). Documentado en ADR.                                                                |
| Mover archivos rompe paths de mocks `vi.mock('@/features/library/...')` en tests externos.                                                                  | 🟠       | Los mocks externos al slice usan `@/features/library/public` (no internals). Posts-split, los re-exports del raíz mantienen los mismos paths. **Verificar grep al cierre de cada fase.**                                                                                                  |
| `library-item-editor.tsx` queda en items/ pero importa de embeds/. Cross-sub-slice import — rompe boundary si no es vía `@/features/library/embeds/public`. | 🟡       | S.2 ya crea `embeds/public.ts` con `EmbedNodeExtension` exportado. S.3 mueve editor a items/ con import vía public — boundary test enforce.                                                                                                                                               |
| Tests con mocks que usan paths internos de library (`@/features/library/server/...`) se rompen al moverlos.                                                 | 🟡       | Pre-S.3/S.4: grep por paths internos en `vi.mock(` de cada test que se mueva. Update path al nuevo.                                                                                                                                                                                       |
| El CI check (S.0) falla en S.0 mismo porque library raíz supera 1500 antes del split.                                                                       | 🟡       | S.0 agrega entry temporal de whitelist con `maxLoc: 7000, adrPath: 'docs/decisions/2026-05-04-library-root-sub-split.md'` y comment `// TEMPORAL — remover en S.5 post-split`. S.5 elimina la entry. Si alguien intenta mergear con la entry temporal viva, el grep al cierre lo cazaría. |
| Sub-slices `access/` y `courses/` ya existentes importan de `library/public` cosas que se mueven a sub-slices nuevos.                                       | 🟢       | Audit confirmó: sólo importan tipos del dominio + permisos + actions de item — todo queda en raíz o se re-exporta desde public.ts. **Cero cambios** en access/courses.                                                                                                                    |
| Plan tidy-stargazing-summit (permission groups G.7) toca `library/` actions de category que se moverán a admin/. Conflicto si corre en paralelo.            | 🟠       | Coordinar: este plan corre primero (cierre estimado 5.5 sesiones), después permission groups G.7 sobre la nueva estructura. Si necesitan correr en paralelo, mergear este plan a main antes de arrancar G.7 — los conflictos serían imports de paths que ya cambiaron.                    |
| Pages que importan de 5+ paths terminan con import bloat visual.                                                                                            | 🟢       | Aceptable — eslint-plugin-import auto-ordena. Si el bloat es severo, un consumer puede crear barrel local en su page (anti-pattern, no recomendado, mejor explícito).                                                                                                                     |
| El check del CI sólo cuenta LOC, no detecta complejidad ciclomática ni archivos individuales >300 LOC.                                                      | 🟢       | Out of scope. Cap por archivo (300 LOC) es responsabilidad del autor de cada PR; no se enforce automático. Plan futuro puede sumar `scripts/lint/check-file-size.ts` (separado).                                                                                                          |

## Verificación

### Por sub-fase

- **S.0**: ADR existe + boundary test verde + script CI ejecuta sin crash. `pnpm lint` corre el check (verifica con whitelist temporal — verde).
- **S.1**: 6 consumers + 4 actions actualizados. `grep -rn "from '\./admin/errors'" src/features/library/` → **0 hits**. Gates verde.
- **S.2**: `find src/features/library/embeds -name "*.ts" -o -name "*.tsx" | wc -l` ≥ 5 archivos. CI check sobre `embeds/` < 1500. `library/public.ts` re-exporta correctamente. Gates verde.
- **S.3**: `find src/features/library/items -name "*.ts" -o -name "*.tsx" | wc -l` ≥ 11 archivos (7 ui + 3 actions + 1 public + tests). CI check sobre `items/` < 1500. 6 pages actualizadas. Gates verde.
- **S.4**: `find src/features/library/admin -name "*.ts" -o -name "*.tsx" | wc -l` ≥ 16 archivos (CategoryListAdmin + form-sheet + 5 wizard + contributors-sheet + groups-scope-sheet + archive-confirm + policy-label + 8 actions + tests + public.ts). CI check sobre `admin/` < 1500. 1 page settings actualizada. Gates verde.
- **S.5**: `find src/features/library -maxdepth 2 -path '*access*' -prune -o -path '*courses*' -prune -o -path '*embeds*' -prune -o -path '*items*' -prune -o -path '*admin*' -prune -o -path '*__tests__*' -prune -o -type f \( -name "*.ts" -o -name "*.tsx" \) -print | xargs wc -l | tail -1` → < 1500 LOC. Whitelist temporal removida. Gates verde + manual smoke 5 escenarios.

### Cierre final (S.5)

- `pnpm typecheck && pnpm lint && pnpm test --run && pnpm build` todo verde.
- **Gate de cero residuos**:
  - `grep -rn "@/features/library/ui/" src/` → **0 hits** (nadie importa deep al raíz UI).
  - `grep -rn "@/features/library/server/actions/" src/ tests/` → **0 hits** (actions vienen via public).
  - `grep -rn "from '\./admin/errors'" src/features/library/` → **0 hits**.
  - WHITELIST de `check-slice-size.ts` no contiene entry para `library` raíz.
- **Métricas reales** documentadas en este plan + en spec § 15:
  - `library/` raíz prod: < 1500 LOC ✓
  - `library/access/` prod: < 1500 LOC ✓
  - `library/courses/` prod: < 1500 LOC ✓
  - `library/embeds/` prod: < 1500 LOC ✓
  - `library/items/` prod: < 1500 LOC ✓
  - `library/admin/` prod: < 1500 LOC ✓
- **Manual smoke (5 escenarios críticos)**:
  1. `/library` (zona) — grid de categorías + recents (raíz: CategoryGrid + RecentsList).
  2. `/library/[cat]` GENERAL — listing items (items/ItemList + raíz LibraryItemRow).
  3. `/library/[cat]` COURSE — listing con lock badges (items/ItemList + courses/LibraryItemLockedRow).
  4. `/library/[cat]/[item]` — detail con MarkComplete (items/header + courses/MarkCompleteButton).
  5. `/settings/library` — admin (admin/CategoryListAdmin + wizard 4-step).

  Si alguno falla → diagnóstico antes de cerrar el plan.

### Cleanup docs

- `docs/features/library/spec.md` § 10.5: actualizar tree con los 5 sub-slices reales + nota "raíz post-split = 1100 LOC ✓".
- `docs/features/library/spec.md` § 15: simplificar — quitar nota "Pendiente ADR de excepción" (ya no aplica), agregar "Sub-split documentado en `docs/decisions/2026-05-04-library-root-sub-split.md`".
- `docs/architecture.md` § Sub-slices: agregar referencia al CI check + a `scripts/lint/check-slice-size.ts` como mecanismo de enforcement.
- `CLAUDE.md` Gotchas: sumar 1 entry — "El cap de 1500 LOC por feature está enforced por `scripts/lint/check-slice-size.ts` (corre en `pnpm lint`). Excepciones autorizadas viven en el WHITELIST array del script + ADR vinculado. Si modificás un slice y `pnpm lint` rechaza por LOC, el camino no es subir el cap — es sub-splittear o redactar ADR de excepción + agregar entry al WHITELIST."

## Alineación con CLAUDE.md y architecture.md

- ✅ **Vertical slices**: cada sub-slice nuevo es vertical (UI + actions + tests propios donde aplica).
- ✅ **Spec antes de código**: spec § 10.5 ya existe (de plan G.1 anterior); este plan lo actualiza con la nueva estructura.
- ✅ **Caps de tamaño**: el plan completo está orientado a respetarlos. El CI check evita que se vuelva a olvidar.
- ✅ **Sin libertad arquitectónica**: las decisiones (qué va dónde, qué se queda en raíz, cómo se enforce) están cerradas en este plan + ADR. Cualquier desviación durante implementación pausa y consulta.
- ✅ **Idioma**: comments + UI labels en español, código en inglés.
- ✅ **TDD**: refactor mecánico (mover archivos), no hay nueva lógica. Tests existentes deben seguir verde sin modificación funcional — solo paths de mocks si aplica.
- ✅ **Production-minded**: nada de quick fixes. Pre-cleanup en S.1 cierra los 2 gaps detectados (errors helper + relative imports) antes de mover archivos. CI check institucionaliza el cap. Cada fase es atómica con gates verde.
- ✅ **Excepción del cap por archivo (300 LOC)**: ningún archivo movido se acerca al cap (max actual: `category-list-admin.tsx` 362 LOC — ya tiene su justificación inherente como UI agregadora; queda en admin/ post-split, sigue justificable).
- ✅ **Connection_limit gotcha**: queries cacheadas con `React.cache` no se tocan en este plan.
- ✅ **`server-only` boundary**: cada `public.server.ts` nuevo declara `import 'server-only'`. Cliente importa solo de `public.ts`.

## Próximo paso

Si el plan se aprueba, arrancamos con **S.0**: redactar el ADR + extender boundary test + crear el CI check con whitelist temporal. NO movemos archivos en S.0.
