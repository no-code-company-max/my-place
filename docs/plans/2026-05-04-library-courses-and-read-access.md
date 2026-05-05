# Plan — Library: courses + read access + wizard + emoji picker

**Fecha:** 2026-05-04
**Estado:** ✅ cerrado (G.7 incluido).
**ADR:** `docs/decisions/2026-05-04-library-courses-and-read-access.md`
**Spec:** `docs/features/library/spec.md` (§ 10.1, § 10.5, § 11.1, § 11.2, § 14 tabla resumen).
**Owner:** Lead — paralelizó con agentes en G.2.a/G.3.a/G.5.a/G.6.a (files disjoint).

## Contexto

Implementar las 12 decisiones D1-D12 cerradas en el ADR. Sub-split del slice `library` en 3 carpetas (`library/` raíz + `library/access/` + `library/courses/`), nuevas tablas (3 read scopes + 1 completion), nuevo flag (course kind), prereq por item, wizard 4-step, emoji picker. Sin RLS (deferida).

**Estado actual del slice**: 5,058 LOC prod + 4,168 LOC tests = 9,226 LOC total. Cap 1,500. Sub-split mantiene cada carpeta bajo el cap original (raíz se queda en ~5k aún tras sub-split — hay un follow-up implícito de migrar parte de raíz a sub-slices, pero NO entra en este plan).

## Estrategia: lead-first foundation, después paralelización agresiva en sub-slices disjoint

Per CLAUDE.md ("Backend y frontend en sesiones separadas cuando sea posible") + architecture.md ("Una sesión = una cosa. Nunca mezclar capas"), las sub-fases se **dividen por capa** (backend vs frontend) **y por slice** (access vs courses vs shared/wizard vs shared/emoji). El lead arma la foundation que destrabea paralelización, y después spawnamos agentes en files disjoint.

## Sub-fases

### G.1 — Lead, sequential — bootstrap foundation (1.5 sesiones)

**Por qué sequential + lead**: toca schema (compartido), boundary test (compartido), public types (compartido). Spawnar agentes acá causa conflicts. Es la base de todo lo demás.

**Pasos**:

1. **Migration M1 — additive single migration**:
   - Enum `LibraryCategoryKind` (GENERAL, COURSE) + columna `LibraryCategory.kind` con default GENERAL.
   - Enum `LibraryReadAccessKind` (PUBLIC, GROUPS, TIERS, USERS) + columna `LibraryCategory.readAccessKind` con default PUBLIC.
   - Columna `LibraryItem.prereqItemId String?` (FK self-ref a `LibraryItem.id`, ON DELETE SET NULL — si se borra el prereq, los items que lo referenciaban quedan sin prereq, no fallan).
   - Tabla `LibraryItemCompletion(itemId, userId, completedAt)` con índice `(userId)` y `(userId, itemId)` PK.
   - Tabla `LibraryCategoryGroupReadScope(categoryId, groupId)` con PK compuesto, FKs ON DELETE CASCADE.
   - Tabla `LibraryCategoryTierReadScope(categoryId, tierId)` idem.
   - Tabla `LibraryCategoryUserReadScope(categoryId, userId)` idem.
   - **Sin RLS policies** en las nuevas tablas (consistente con sesión 2026-05-04 — RLS deferida).

2. **Apply migration** al cloud dev: `pnpm exec dotenv -e .env.local -- pnpm prisma migrate deploy`. **Regen Prisma client**: `pnpm prisma generate`. Verificar typecheck.

3. **Sub-slice bootstrap**: crear estructura de carpetas + esqueletos:
   - `src/features/library/access/{public.ts, public.server.ts, domain/, server/actions/, server/queries.ts, ui/}`
   - `src/features/library/courses/{public.ts, public.server.ts, domain/, server/actions/, server/queries.ts, ui/}`
   - Cada `public.ts` y `public.server.ts` con header doc + sin exports todavía (los popula G.2.a / G.3.a).

4. **Domain types compartidos** en `src/features/library/domain/types.ts`:
   - Add `LibraryCategoryKind` enum string union + values array.
   - Add `LibraryReadAccessKind` enum string union + values array.
   - Update `LibraryCategory` type con `kind`, `readAccessKind`.
   - Update `LibraryItem` type con `prereqItemId: string | null`.
   - **`LibraryViewer`** agrega `tierIds: ReadonlyArray<string>` como **REQUIRED** (no opcional). Esto rompe typecheck — fix en mismo paso para todos los callsites: pasar `tierIds: []` defensive (G.4 los populva con valor real). Defensive vacío es safe porque `canReadCategory()` aún no se llama en ninguna page (ese check entra en G.2.b).

5. **Extender queries raíz library** (sólo exposición de campos nuevos en SELECTs, sin lógica nueva):
   - `findLibraryCategoryBySlug` / `findLibraryCategoryById` / `listLibraryCategories` (en `src/features/library/server/queries/categories.ts`): agregar `kind: true`, `readAccessKind: true` al select. Mapper popula los nuevos campos.
   - `findLibraryItemBySlug` / `listItemsByCategory` (en `src/features/library/server/queries/items.ts` o equivalente): agregar `prereqItemId: true`. Mapper.
   - **Esto debe pasar en G.1** porque G.2.a y G.3.a van a leer estos campos. Si lo dejamos para los agentes, ambos van a querer modificar los mismos archivos → conflict.

6. **Boundary test extension** (`tests/boundaries.test.ts`):
   - Reglas existentes mantienen.
   - **Nueva regla**: archivo bajo `src/features/<slice>/<sub-slice>/` puede importar de `@/features/<slice>/public` y `@/features/<slice>/public.server` (parent reference). Pero NO puede importar `src/features/<slice>/server/internals` ni de otro `<sub-slice>` directo (tiene que ir vía `@/features/<slice>/<sub-slice-other>/public`).
   - **Nueva regla**: si el sub-slice tiene `public.server.ts`, debe tener `import 'server-only'` al tope.
   - Tests cubriendo: import válido (parent public), import inválido (parent internals), import válido (sibling sub-slice via public), import inválido (sibling internals).

7. **Tests fixture update**: cualquier fixture en `__tests__/` que crea `LibraryCategory` mock necesita `kind: 'GENERAL'`, `readAccessKind: 'PUBLIC'`, `groupScopeIds: []`. Cualquier mock de `LibraryItem` necesita `prereqItemId: null`. Cualquier mock de `LibraryViewer` necesita `tierIds: []`. Lead barrido mecánico.

**Validation gate**: `pnpm typecheck` ✓, `pnpm lint` ✓, `pnpm test --run` ✓ (sin tests nuevos), `pnpm exec cross-env NODE_ENV=production pnpm build` ✓. **Grep final**: `grep -rn 'LibraryCategoryKind\|LibraryReadAccessKind' src/` debe retornar hits sólo en types.ts, categories.ts query, schema.prisma — confirma exposición correcta.

**LOC estimadas**: ~80 (schema/migration) + ~60 (esqueletos sub-slices) + ~30 (boundary test) + ~50 (types update) + ~100 (queries raíz extension) + ~80 (fixtures update) = **~400 LOC**.

---

### G.2.a + G.3.a + G.5.a + G.6.a — 4 agentes en paralelo, files disjoint (1 sesión wall-clock)

**Pre-requisitos**: G.1 completo (schema + bootstrap + queries raíz + types). Lead audita que los 4 agentes NO compartan files antes de spawnarlos.

**Files matrix de paralelización** (verificación sin overlap):

| Agente                       | Files que toca                                                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **A — backend access**       | `src/features/library/access/{domain,server,ui}/*` (sub-slice nuevo) + tests en `library/access/__tests__/`                          |
| **B — backend courses**      | `src/features/library/courses/{domain,server,ui}/*` (sub-slice nuevo) + tests en `library/courses/__tests__/`                        |
| **C — wizard primitive**     | `src/shared/ui/wizard/*` (carpeta nueva) + tests `src/shared/ui/wizard/__tests__/`                                                   |
| **D — emoji picker wrapper** | `src/shared/ui/emoji-picker/*` (carpeta nueva) + tests `src/shared/ui/emoji-picker/__tests__/` + `package.json` (instalar frimousse) |

**Cero overlap verificado**. D toca `package.json` único — agentes B/C no lo hacen.

#### Agente A — backend `library/access/`

**Scope**:

- Domain `library/access/domain/permissions.ts`: `canReadCategory(category, viewer)` y `canReadItem(item, category, viewer)`. TDD primero.
- Schemas Zod `library/access/schemas.ts`: `setLibraryCategoryReadScopeInputSchema` discriminated union por `kind`.
- Server action `library/access/server/actions/set-read-scope.ts`: owner-only, override completo, valida pertenencia (groups al place, tiers al place, users active members), tx delete + create de las 3 tablas según kind.
- Queries `library/access/server/queries.ts`: `findReadScope(categoryId)` joined retorna `{ kind, groupIds[], tierIds[], userIds[] }`. Cacheable React.cache.
- Public exports en `library/access/public.ts` (action + types) y `public.server.ts` (queries).
- Tests TDD: ~25 tests cubriendo permissions (4 kinds + admin/owner bypass), action (validación, auth, payload mismatch, tx), queries.

**LOC estimadas**: ~120 (domain+schemas) + ~150 (action) + ~80 (queries) + ~280 (tests) = **~630 LOC**.

#### Agente B — backend `library/courses/`

**Scope**:

- Domain `library/courses/domain/permissions.ts`: `canMarkItemCompleted(item, viewer)` + `canOpenItem(item, viewer, completedItemIds)`.
- Domain `library/courses/domain/prereq-validation.ts`: `validateNoCycle(itemId, candidatePrereqId, allItemsLookup): boolean` con BFS, max depth 50. Tests cubriendo: ciclo directo (A→A), indirecto (A→B→A), profundo, no-ciclo válido.
- Schemas Zod `library/courses/schemas.ts`: `setItemPrereqInputSchema`, `markItemCompletedInputSchema`, `unmarkItemCompletedInputSchema`.
- 3 actions: `set-item-prereq.ts` (gate `library:moderate-categories` o author), `mark-item-completed.ts`, `unmark-item-completed.ts`. Discriminated union return.
- Queries `library/courses/server/queries.ts`: `listCompletedItemIdsByUser(userId, placeId): string[]` (cacheable React.cache, performance crítico). `findItemPrereqChain(itemId, allItems)` (display de cadena).
- Public exports.
- Tests TDD: ~50 tests (action set-prereq con ciclos + validación, mark/unmark idempotencia, queries con datasets sintéticos).

**LOC estimadas**: ~150 (domain) + ~250 (3 actions) + ~120 (queries) + ~500 (tests) = **~1,020 LOC**.

#### Agente C — wizard primitive `src/shared/ui/wizard/`

**Scope**:

- `<Wizard>` orchestrator con state management interno (current step + per-step validity).
- `<WizardHeader>` con indicador X de N + breadcrumb opcional + X cierre.
- `<WizardBody>` que renderiza el step actual (children render-prop pattern: el consumer pasa array de steps con `id`, `label`, `Component`).
- `<WizardFooter>` con `<WizardBack>` (disabled en step 0) y `<WizardNext>` (cambia label a "Guardar" en último, disabled si step inválido).
- API: cada step recibe `value`, `onChange`, `onValid: (boolean) => void`. Wizard trackea validity y disabled.
- Sin draft persistence. Cierre = pierde progreso (decisión D8/C5).
- Tests TDD: state machine (avanzar, retroceder, no avanzar si inválido), keyboard nav (tab + enter), validation per step.
- **NO integra con BottomSheet** — es genérico, el consumer lo mete en cualquier container.

**Cap warning**: si supera 300 LOC un archivo, splittear. Preferiría 1 archivo `wizard.tsx` con todo + tests aparte; si crece, splittear sub-componentes.

**LOC estimadas**: ~250 (primitive) + ~150 (tests) = **~400 LOC**.

#### Agente D — emoji picker wrapper `src/shared/ui/emoji-picker/`

**Scope**:

- `pnpm add frimousse` (libreria + cero deps).
- `<EmojiPicker value={...} onChange={...} />` wrapper (controlled).
- Configuración: `locale="es"`, native unicode, skin tones OFF, recents OFF, default category "Smileys & People".
- API mobile-friendly: el wrapper renderiza inline (full-width). El consumer decide container (Popover desktop / push interno BottomSheet mobile).
- Implementar 2 variants exportadas:
  - `<EmojiPickerInline>` — render directo (mobile push interno usa esto).
  - `<EmojiPickerPopover>` — Radix Popover wrapper (desktop usa esto).
- Helper `useResponsiveEmojiPicker()` que retorna el componente correcto según breakpoint (≥768px = popover).
- Tests TDD: render, search, select dispara onChange con unicode, locale es funciona.
- **NO integra con BottomSheet ni con form** — es genérico.

**LOC estimadas**: ~150 (wrapper + variants + helper) + ~80 (tests) = **~230 LOC**.

#### Coordinación

Lead spawneará los 4 agentes en una sola tool message (multi tool call). Cada agente reporta cuando termina. **Lead audita** al recibir todos los reportes:

1. Typecheck global verde con los 4 sub-slices/wrappers integrados.
2. Lint verde.
3. Suite verde (~+100 tests).
4. Boundary test verde — confirma sub-slices respetan parent-only import rule.
5. Build verde.
6. Grep no hits cross-import inválidos.

Si algún agente reportó algo fuera de scope o tomó decisiones nuevas (no en el ADR), el lead las evalúa antes de mergear. Si bloqueante, agente B se reabre con corrección.

---

### G.4 — Lead, sequential — `LibraryViewer.tierIds` populated cross-slice (0.5 sesión)

**Por qué sequential + lead**: cross-slice (members/discussions ↔ tiers ↔ library). Riesgo de break global si un caller queda sin populated. NO paraleliza.

**Pasos**:

1. **Identificar `resolveActorForLibrary`** (o equivalente — verificar dónde se construye `LibraryViewer` hoy. Sospecha: `src/features/discussions/server/actor.ts:resolveActorForPlace` lo construye o lo extiende).
2. Sumar query: `prisma.tierMembership.findMany({ where: { userId, placeId, leftAt: null, OR: [{expiresAt: null}, {expiresAt: { gt: now }}] }, select: { tierId: true } })`. Mapear a `string[]`.
3. **Cachear con `React.cache`** en mismo request — el caller ya lo está.
4. Update todos los callsites que construyen `LibraryViewer` con `tierIds: []` defensive (G.1) → `tierIds: <real value>` (G.4).
5. Tests: actualizar fixtures de `LibraryViewer` en `__tests__/` con tierIds reales en escenarios donde aplique. Cubrir `canReadCategory()` con TIER kind.

**Validation gate**: typecheck ✓, lint ✓, suite ✓, build ✓.

**LOC estimadas**: ~50 (resolver + populate) + ~60 (tests update) = **~110 LOC**.

---

### G.5+6.b — Lead, sequential — wizard refactor + emoji picker integrado en form-sheet (2 sesiones)

**Por qué sequential + lead**: refactor de `category-form-sheet.tsx` + integración de wizard primitive (G.5.a) + emoji picker (G.6.a). Toca files compartidos con G.2.b/G.3.b (mismas pages) — pero `category-form-sheet.tsx` es dominio de admin/edit, no de viewing — desconexión real.

**Pasos**:

1. **Refactor `library/ui/admin/category-form-sheet.tsx`** a 4 steps:
   - Step 1: emoji picker (G.6) + nombre.
   - Step 2: contribution policy (lo que ya tenemos de F.1-F.5, mover acá).
   - Step 3: read access (discriminator único + sub-picker condicional, importa de `library/access/public`).
   - Step 4: course toggle (sólo flag, importa de `library/courses/public`).

2. **Submit final atomic**: secuencia `createCategory → setReadScope (si ≠ PUBLIC) → setGroupScope (si SELECTED_GROUPS) → setDesignatedContributors (si DESIGNATED) → updateCategoryKind (si COURSE)`. Si falla cualquier intermedio post-create, toast con motivo + categoría queda creada.

3. **Validación por step** (D12 + C2): cada step con su Zod schema. `<WizardNext>` disabled hasta válido. Errors inline por field.

4. **Mobile UX wizard**: integrar `<Wizard>` dentro de `<BottomSheetContent>`. El wizard ocupa el body, el header sticky muestra step indicator, el footer sticky tiene Back/Next.

5. **Emoji picker integration**:
   - Mobile (<768px): tap al botón emoji → push interno del BottomSheet (cambia content a `<EmojiPickerInline>` con header "← Volver"). Este es el patrón Notion iOS.
   - Desktop (≥768px): popover con `<EmojiPickerPopover>` anclado al botón.
   - El consumer del wizard implementa la lógica de "push interno" — no es el wizard primitive (que es genérico) ni el picker (que es genérico).

6. **Tests**: vitest del CategoryFormSheet refactorizado — cada step valida lo suyo + submit final invoca actions correctas en orden + manejo de errors intermedios.

**Validation gate**: typecheck ✓, lint ✓, suite (~+30 tests) ✓, build ✓. **Manual smoke obligatorio**: crear categoría completa con cada combinación de policies + course flag. Mobile 360px Safari + Chrome.

**LOC estimadas**: ~400 (form-sheet refactor) + ~100 (push interno integration) + ~200 (tests) = **~700 LOC**.

---

### G.2+3.b — Lead, sequential — frontend integration en pages (1.5 sesión)

**Por qué sequential + lead**: ambos sub-slices (access + courses) tocan las mismas pages (`library/[categorySlug]/page.tsx`, `[itemSlug]/page.tsx`). Splittear a 2 agentes paralelos genera conflict directo. Lead lo hace de un saque.

**Pasos**:

1. **Page integrations** en `src/app/[placeSlug]/(gated)/library/`:
   - `[categorySlug]/page.tsx`: invoca `canReadCategory()`. Si false → renderiza inline access denied (decisión D11 distinción): paywall view dedicado pq es read access denied (no prereq).
   - `[categorySlug]/[itemSlug]/page.tsx`: invoca `canReadItem()` (read access). Si false → access denied view. Si true: invoca `canOpenItem()` con `listCompletedItemIdsByUser()`. Si false (prereq incompleto) → server-side ya sirve el contenido pero con flag `isLockedByPrereq`.

2. **UI components nuevos**:
   - `<ItemAccessDeniedView>` (presentational, en `library/access/ui/`): card con copy "No tenés acceso a este contenido. [motivo según readAccessKind]." Diseño calmo, no marketing-y.
   - `<PrereqLockBadge>` (en `library/courses/ui/`): candado SVG + tooltip estático "Completá [X] primero". Render en listing rows.
   - `<MarkCompleteButton>` (Client, en `library/courses/ui/`): usa `markItemCompletedAction`. Render condicional: sólo si `categoria.kind === COURSE` y viewer no es bot/anónimo.
   - `<PrereqSelector>` (Client, en `library/courses/ui/`): dropdown para elegir prereq al crear/editar item. Lista items en la misma categoría. Sólo aparece en form si categoría es COURSE. Validación inline: avisa si elección crea ciclo (chequeo client-side optimista; server vuelve a validar).
   - **Toast handler para prereq incompleto**: en el listing de items, si el viewer hace click en un item con prereq incompleto, en vez de navegar dispara `toast.info('Completá [X] antes de abrir esto', { action: { label: 'Ir a [X]', onClick: () => router.push(...) } })`. Esto vive en el `<ItemListRow>` como wrapper de comportamiento.

3. **Form `library/ui/library-item-form.tsx`** (asume existe): integrar `<PrereqSelector>` cuando `category.kind === 'COURSE'`. La prereq se setea via `setItemPrereqAction` después del create/update item (o en la misma tx — verificar estructura del form de item).

4. **Tests**:
   - Pages con `canReadCategory` denied → asserts del view denied view.
   - Pages con `canOpenItem` false → asserts del lock + toast disparado.
   - `<PrereqSelector>` form integration.
   - `<MarkCompleteButton>` action invocation.

**Validation gate**: typecheck ✓, lint ✓, suite (~+30 tests) ✓, build ✓.

**LOC estimadas**: ~200 (page integrations) + ~250 (UI components) + ~150 (form integration) + ~250 (tests) = **~850 LOC**.

---

### G.7 — Lead, sequential — spec final + cleanup + manual smoke + seed E2E (0.5 sesión)

**Pasos**:

1. **Update `docs/features/library/spec.md`** completo:
   - § Vocabulario: ya parcialmente actualizado en G.0. Verificar.
   - § Permisos: tabla matriz extendida con read access (4 columnas: PUBLIC/GROUPS/TIERS/USERS) + course (Mark Complete, Open with prereq).
   - § Modelo de datos: schema extendido con todas las tablas nuevas (renderizar bloques Prisma).
   - § Sub-fases R.7: cerrar sub-fases R.7.X (read access) y R.7.Y (courses) marcadas como ✅.
   - § Architecture: documentar sub-split + boundary rule de "child puede importar parent public".

2. **Update `docs/architecture.md`** (si necesario): nota corta sobre patrón sub-slice + cómo el boundary test lo enforce.

3. **Seed E2E** `tests/fixtures/e2e-data.ts`: agregar 1 categoría `kind: COURSE` en palermo con cadena de prereqs A → B → C (3 items con prereqItemId encadenado). Para tests de E2E manuales y futuros automatizados.

4. **Update `tests/fixtures/e2e-seed.ts`**: persistir la nueva categoría + items + prereqs.

5. **Manual smoke checklist** (obligatorio antes de cerrar):
   - [ ] Owner crea categoría general → editarla → archivar (regresión F.5).
   - [ ] Owner crea categoría course con cadena A → B → C.
   - [ ] Member sin read access (categoría en GROUPS sin estar en grupo) → abre item → access denied view.
   - [ ] Member CON read access intenta abrir item con prereq incompleto → toast info + acción funciona.
   - [ ] Member completa A → al refresh, B se desbloquea visualmente (lock removido del listing).
   - [ ] Member completa B → C se desbloquea.
   - [ ] Owner edita read access (PUBLIC → TIERS con tier X) → member sin tier X pierde acceso al refrescar.
   - [ ] Wizard 4-step funciona en mobile 360px (iOS Safari + Chrome): cada step valida, Next se habilita correctamente, X cierra y pierde progreso, Back preserva state.
   - [ ] Emoji picker abre como push interno en mobile, popover en desktop. Search en español funciona.

6. **Final grep** (cero hits esperados):
   - `grep -rn 'TODO F\.\|TODO G\.' src/features/library/` → sólo TODOs explícitamente diferidos a fases futuras.
   - `grep -rn 'ADMIN_ONLY' src/ tests/` → sigue siendo cero post-F.5.

7. **Auto-verify final**: typecheck ✓, lint ✓, suite completa ✓, build ✓.

8. **Reportar tamaños** finales por sub-slice:
   - `find src/features/library -maxdepth 1 -name "*.ts" -o -name "*.tsx" | xargs wc -l` (raíz directo).
   - `find src/features/library/access -name "*.ts" -o -name "*.tsx" | xargs wc -l`.
   - `find src/features/library/courses -name "*.ts" -o -name "*.tsx" | xargs wc -l`.
   - `find src/shared/ui/wizard src/shared/ui/emoji-picker -name "*.ts" -o -name "*.tsx" | xargs wc -l`.
   - Si algún sub-slice supera 1500 LOC al cierre, escalar a ADR de excepción específico (no se anticipa que pase).

**LOC estimadas**: ~150 (spec/docs) + ~100 (seed E2E update).

---

## Total estimado revisado

- LOC delta: **~4,340 LOC** distribuidas en 5 carpetas (library/ raíz + library/access/ + library/courses/ + shared/ui/wizard + shared/ui/emoji-picker) + tests + spec.
- Sesiones: **~7** (vs 8.5 plan original, gracias a la paralelización del bloque G.2.a/G.3.a/G.5.a/G.6.a).
- Migrations Prisma: 1 (additive todo en G.1).
- Agentes paralelos: 4 (en una única wall-clock session de G.2.a/G.3.a/G.5.a/G.6.a).

## Validation gates por sub-fase

| Sub-fase | Owner       | Files disjoint                              | typecheck | lint | tests          | build | Manual smoke            |
| -------- | ----------- | ------------------------------------------- | --------- | ---- | -------------- | ----- | ----------------------- |
| G.1      | Lead        | —                                           | ✓         | ✓    | ✓ (sin nuevos) | ✓     | —                       |
| G.2.a    | **Agent A** | `library/access/*`                          | ✓         | ✓    | ~+25           | ✓     | —                       |
| G.3.a    | **Agent B** | `library/courses/*`                         | ✓         | ✓    | ~+50           | ✓     | —                       |
| G.5.a    | **Agent C** | `shared/ui/wizard/*`                        | ✓         | ✓    | ~+15           | ✓     | —                       |
| G.6.a    | **Agent D** | `shared/ui/emoji-picker/*` + `package.json` | ✓         | ✓    | ~+10           | ✓     | —                       |
| G.4      | Lead        | —                                           | ✓         | ✓    | ✓ (updated)    | ✓     | —                       |
| G.5+6.b  | Lead        | —                                           | ✓         | ✓    | ~+30           | ✓     | wizard mobile 360px     |
| G.2+3.b  | Lead        | —                                           | ✓         | ✓    | ~+30           | ✓     | —                       |
| G.7      | Lead        | —                                           | ✓         | ✓    | full suite     | ✓     | 9 escenarios E2E manual |

## Riesgos identificados (ampliados respecto al ADR)

| #   | Riesgo                                                                               | Mitigación                                                                                                                                                |
| --- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Sub-split rompe imports E2E que importan internals                                   | G.1 corre `grep -rn "from '@/features/library/server/" tests/` y refactoriza al public correspondiente.                                                   |
| 2   | Wizard primitive supera 300 LOC archivo                                              | G.5.a splittea sub-componentes (`<WizardHeader>`, `<WizardFooter>` aparte).                                                                               |
| 3   | Emoji picker push interno rompe focus trap del BottomSheet en iOS                    | Manual smoke en G.5+6.b en iOS Safari. Si rompe, rollback a popover en mobile (degraded UX).                                                              |
| 4   | `LibraryViewer.tierIds` requiere extender resolver cross-slice                       | G.4 lo hace con cuidado. Si `resolveActorForPlace` no está claro dónde vive, lead mapea antes con `grep -n "LibraryViewer" src/`.                         |
| 5   | Validación de ciclos en prereqs es app-layer                                         | BFS depth 50 + tests cubriendo ciclo directo/indirecto/profundo. Owner-only, sin race realista.                                                           |
| 6   | Read access JOIN escala mal con N alto                                               | Place max 150 miembros + scopes < 20 entries típico → no scaling issue. Index `(categoryId)` en cada tabla. React.cache.                                  |
| 7   | `listCompletedItemIdsByUser` con N=1000+ items es lento                              | Cap teórico de items por place no definido. Si crece, agregar paginación o limitar al place actual. Por ahora N esperado <50 → React.cache es suficiente. |
| 8   | Sub-slices `library/courses/` y `library/access/` ambos importan de `library/public` | Diseñado así. Boundary test extendido en G.1 lo permite explícitamente.                                                                                   |
| 9   | RLS deferida — ataque vía SQL directo bypassa app-layer                              | Aceptado por sesión 2026-05-04. Cuando llegue fase RLS, `is_place_member` será suficiente para gatear todo.                                               |
| 10  | Agente paralelo sale fuera de scope o agrega lógica nueva                            | Brief explícito + lead audita reportes antes de mergear. Si bloqueante, reabre con corrección.                                                            |
| 11  | Migration M1 falla en cloud dev por constraint o data inconsistente                  | M1 es additive (sólo CREATE TABLE + ADD COLUMN nullable). Sin destructive DDL. Rollback con `prisma migrate resolve --rolled-back`.                       |
| 12  | Form-sheet refactor (G.5+6.b) rompe tests E2E que dependen del UI viejo              | Tests E2E del slice library cubren create/edit categoría — ajustar selectors al wizard.                                                                   |

## Rollback strategy por sub-fase

| Si falla en                   | Qué se revierte                                                                                                                         |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| G.1                           | `prisma migrate resolve --rolled-back` + `git revert` del commit de bootstrap. Cero impacto data (sólo additive).                       |
| G.2.a / G.3.a / G.5.a / G.6.a | `git revert` del commit del agente. Cero impacto data (no se llaman desde pages todavía).                                               |
| G.4                           | `git revert` cambio del resolver. `tierIds: []` defensive vuelve a la default (empty). Pages aún no chequean tierIds (entran en G.2.b). |
| G.5+6.b                       | `git revert` del refactor del form-sheet. Vuelve al form lineal de F.5. UI degraded pero funcional.                                     |
| G.2+3.b                       | `git revert` de cambios a pages + cleanup de UI components nuevos. Lectura vuelve a "todos ven todo" + items sin lock.                  |
| G.7                           | Cosmético — docs + seed. Sin impacto runtime.                                                                                           |

## Por qué este plan es production-grade y respeta CLAUDE.md/architecture.md

1. **Vertical slices respetadas**: cada sub-slice (access, courses) es autónomo con su public.ts. Sub-imports al parent via public.ts (no internals).
2. **Boundary test extendido en G.1**: enforce automático de la regla "child puede importar parent public, no internals".
3. **Backend y frontend separados**: G.2.a + G.3.a son backend; G.2+3.b es frontend. Mismo patrón G.5.a (UI primitive) vs G.5+6.b (UI integration).
4. **Una sub-fase = una responsabilidad**: cada G.x toca una capa o un sub-slice.
5. **TDD obligatorio**: cada agente arranca con tests rojos.
6. **Spec antes de código**: ADR + plan + spec update parcial ya escrito (G.0 completo). Spec final completo en G.7.
7. **Sin libertad arquitectónica**: las 12 decisiones del ADR son la fuente. Agentes briefed para no inventar.
8. **Caps respetados**: cada sub-slice arranca chico, monitoreo en G.7. Wizard primitive con cap warning explícito.
9. **Idioma**: comentarios + UI + commits en español, código en inglés.
10. **Auto-verificación per sub-fase**: gates explícitos en la tabla.
11. **Migrations additive**: rollback simple, sin DDL destructivo en este plan.
12. **Paralelización agresiva en disjoint files**: 4 agentes en una sola wall-clock session reduce el plan de 8.5 a 7 sesiones.

## Próximo paso

Si el plan se aprueba, arrancamos con **G.1** (lead, sequential, ~1.5 sesión). Después spawnamos los 4 agentes en paralelo para G.2.a + G.3.a + G.5.a + G.6.a.
