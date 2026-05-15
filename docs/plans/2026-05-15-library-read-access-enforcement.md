# Plan — Enforcement de read-access de biblioteca (Hallazgo #2, SEGURIDAD)

**Fecha**: 2026-05-15
**Estado**: APROBADO 2026-05-15 — orden: ejecutar ANTES que Plan B
(decisión del owner: seguridad primero). Scope: app-layer + RLS (S4
incluida). En ejecución secuencial.
**Severidad**: alta — vulnerabilidad de confidencialidad. Categorías
configuradas como restringidas (`readAccessKind != PUBLIC`) son legibles
por cualquier miembro del place.

## Contexto

El modelo de read-access (`LibraryCategory.readAccessKind` PUBLIC/GROUPS/
TIERS/USERS + 3 tablas pivote) está documentado (ADR
`2026-05-12-library-permissions-model.md`), configurable desde
`/settings/library`, con helpers `canReadCategory`/`canReadItem` y UI de
denegación `<ItemAccessDeniedView>` ya implementados y testeados — pero
**con cero callers en producción**. Ninguna page/action/query de lectura
lo invoca. El RLS tampoco lo cubre (no existe `is_in_category_read_scope`;
el slice usa cliente service-role que bypassa RLS por diseño).

### Superficie de exposición (10 puntos, del diagnóstico)

| #   | Punto                                                         | Expone                                                        |
| --- | ------------------------------------------------------------- | ------------------------------------------------------------- |
| 1   | `library/[categorySlug]/page.tsx:67` (`listItemsByCategory`)  | Lista de items de categoría restringida                       |
| 2   | `[itemSlug]/_library-item-content.tsx:48` (`findItemBySlug`)  | Body completo + metadata del item                             |
| 3   | `library/page.tsx:47` (`listRecentItems`)                     | Top-5 recientes incluye items restringidos (landing)          |
| 4   | `library/page.tsx:45` (`listLibraryCategories`)               | Listado de categorías — _plano por diseño del ADR, NO es bug_ |
| 5   | `mention-search.ts:57` `searchLibraryItems`                   | Títulos/slugs por autocomplete `@`, sin viewer                |
| 6   | `mention-search.ts:36` `listCategoriesForMention`             | Nombres/slugs de categorías restringidas                      |
| 7   | `mention-search.ts:102` `findLibraryItemForMention`           | Link+título de item restringido embebido en threads           |
| 8   | `courses/.../mark-item-completed.ts:36` + unmark              | Completion en item restringido (confirma existencia)          |
| 9   | `courses/server/queries.ts:123/26` (prereq lookup, completed) | Títulos/slugs de items-curso restringidos                     |
| 10  | Cross-slice: `conversations/[postSlug]/page.tsx:64` redirect  | Doble puerta abierta (ni conversations ni destino gatean)     |

Punto 4 queda **fuera de scope** (el listado plano de categorías es
decisión explícita del ADR, no fuga — el contenido es lo protegido, no
la existencia del nombre de categoría).

## Decisiones arquitectónicas (fijadas)

| #   | Decisión                                                                                                                                            | Razón                                                                                                                                                                                                                                    |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A   | Fix primario = **app-layer**, espejo exacto del patrón write de `create-item.ts:85-105` (`resolveLibraryViewer` + `findReadScope` + helper de gate) | `findReadScope` ya existe (`access/server/queries.ts:44`), estructuralmente idéntico a `findWriteScope` ya probado. Reuso, no invención.                                                                                                 |
| B   | El gate es **`canReadCategory(ctx,viewer) \|\| canWriteCategory(...)`**                                                                             | Write implica read. Sin el OR, un contributor (write-scope) fuera del read-scope perdería lectura de la categoría donde escribe → **regresión #1**. El ADR delega esta implicación "al composer"; la centralizamos en un helper.         |
| C   | RLS = **defensa en profundidad**, no capa primaria                                                                                                  | El slice usa cliente service-role (`db/client.ts:47`, `DATABASE_URL`) que bypassa RLS; removerlo exige reescribir todo el slice. App-layer es la puerta real, RLS es backstop (mismo criterio que el comment de `create-item.ts:82-84`). |
| D   | Reusar `<ItemAccessDeniedView>` existente                                                                                                           | Ya implementado y testeado; el plan solo lo wirea.                                                                                                                                                                                       |
| E   | Sin backfill de datos                                                                                                                               | Default schema `readAccessKind = PUBLIC` → categorías existentes no se rompen. Solo query de auditoría de las no-PUBLIC con pivotes vacíos.                                                                                              |
| F   | Helper único compartido `assertCategoryReadable`                                                                                                    | Un solo punto de verdad, auditable, evita drift entre los 10 call-sites.                                                                                                                                                                 |

## Sesiones

### S1 — Helper compartido + tests (sin cablear) ✅ EJECUTADA

**Resultado**: NEW `access/server/assert-readable.ts` (~95 LOC):
`canViewCategory` (boolean, UI) + `assertCategoryReadable`
(NotFoundError si no existe / AuthorizationError si denegado). Núcleo
`resolveAccess` aplica `canReadCategory || canWriteCategory` (decisión
B). Reusa `findReadScope` + `findWriteScope` (cacheados). Exportado en
`access/public.server.ts`. NEW test `__tests__/assert-readable.test.ts`
(10 tests TDD red→green): PUBLIC, owner bypass, admin-no-owner NO
bypassa, GROUPS match/no-match, write-implica-read, inexistente.
Typecheck verde, library 307/307 (cero regresión). Nada cableado aún.

### S1 — Plan original (referencia)

- NEW `src/features/library/access/server/assert-readable.ts` (~70 LOC):
  `assertCategoryReadable({ categoryId, viewer })` → resuelve
  `findReadScope` + `findWriteScope`, aplica `canReadCategory ||
canWriteCategory`, owner/PUBLIC short-circuit (ya en `canReadCategory`).
  Throw `AuthorizationError` tipado si deniega. Variante
  `canViewCategory(...)` que retorna boolean (para casos UI que no
  deben throw).
- Tests TDD (`access/__tests__/assert-readable.test.ts`, ~120 LOC):
  PUBLIC ok, owner bypass, GROUPS/TIERS/USERS match/no-match,
  write-implica-read, categoría inexistente.
- Export en `library/access/public.server.ts`.
- **No cablea nada todavía.** Riesgo deploy: cero.

> **Reorden de ejecución (2026-05-15)**: punto 3 (recents en landing)
> movido a S3. Razón técnica: `LibraryItemListView` no expone
> `categoryId` (solo `categorySlug`); filtrar recents por legibilidad
> requiere resolución cross-categoría — misma técnica que mention-search
> (5-9). S2 cubre 1, 2 (mayor severidad: lista completa de items + body
> completo) y 10 (documentado). No reduce scope: reagrupa por afinidad.

### S2 — Enforcement en pages de lectura ✅ EJECUTADA (puntos 1,2; 10 documentado)

**Resultado**: `library/[categorySlug]/page.tsx` + `[itemSlug]/
_library-item-content.tsx` ahora gatean con `canViewCategory` tras
resolver viewer+categoría; si deniega → `<ItemAccessDeniedView
readAccessKind={findReadScope.kind}>` (no notFound — mensaje explícito
del ADR). `findReadScope` cacheado (0 round-trips extra: el helper ya
lo llamó). Punto 10 (conversations redirect): NO se toca código — el
destino (item content) ya rechaza con ItemAccessDeniedView; el redirect
no fuga body (decisión del plan, se documenta en ADR S5). Typecheck
verde, library+discussions 575/575 (cero regresión).

### S2 — Plan original (referencia, puntos 1,2,10)

- `library/[categorySlug]/page.tsx`: `assertCategoryReadable` top-level
  tras resolver viewer; si deniega → `<ItemAccessDeniedView>` (no
  notFound — el ADR quiere mensaje explícito).
- `[itemSlug]/_library-item-content.tsx` (+ su page): idem por la
  categoría del item.
- `library/page.tsx`: `listRecentItems` filtrado por categorías
  legibles para el viewer (resolver scopes una vez, filtrar in-memory
  o query con `where categoryId in (legibles)`).
- Punto 10: `conversations/[postSlug]/page.tsx` — antes del
  `permanentRedirect` a `/library/...`, si el post es libraryItem,
  gatear read-access (o garantizar que el destino S2 lo rechaza con
  ItemAccessDeniedView, no con leak). Decidir: gate en redirect vs
  confiar en destino. Recomendación: el destino ya lo cubre; el redirect
  no fuga body. Documentar.
- Tests por page. Smoke manual de los 4 readAccessKind.

### S3 — ✅ EJECUTADA (puntos 3,5,6,8 cerrados; 9 por caller; 7 follow-up)

**Resultado**:

- **5,6** `actions/mention-search.ts`: resuelve viewer post-cache +
  `canViewCategory` → categorías/items de categorías restringidas no
  aparecen en autocomplete para quien no tiene acceso.
- **3** `library/page.tsx`: recents filtrados reusando
  `listLibraryCategoriesForMentionAction` (ya filtra legibilidad);
  match por `categorySlug` (LibraryItemListView no expone categoryId).
- **8** `mark-item-completed.ts`: `resolveActorForPlace` →
  `resolveLibraryViewer` + `assertCategoryReadable`. Comentario falso
  ("caller ya validó read access") corregido. Test reescrito a mocks de
  boundary + cobertura del gate (deniega → AuthorizationError).
- **unmark**: NO se gatea — decisión consciente documentada en el
  archivo: solo borra completion propia (cero fuga) y gatear rompería
  el caso legítimo "perdí acceso, limpio mi lista".
- **9** `listCategoryItemsForPrereqLookup`/`listCompletedItemIdsByUser`:
  queries puras; sus callers ya gatean (category page/item content tras
  S2; new/edit por write-scope). Patrón "query pura, caller gatea"
  (decisión C) — no se gatea dentro de la query.
- **7 `findLibraryItemForMention`** → **FOLLOW-UP, no en S3**. Es el
  resolver de menciones cross-slice (renderiza título+link de un item
  mencionado en cualquier thread). Gatearlo exige propagar el viewer
  por `buildMentionResolvers` (usado en todo render de discussions) —
  refactor cross-slice de severidad baja (un título embebido). Se
  separa para no parchear un refactor cross-slice al final de sesión;
  queda registrado en el ADR S5 como follow-up explícito con su
  diagnóstico.

Typecheck verde. Suite completa 2132/2132 (cero regresión).

### S3 — Plan original (referencia, puntos 5,6,7,8,9)

- `mention-search.ts` (`searchLibraryItems`, `listCategoriesForMention`,
  `findLibraryItemForMention`): hoy reciben solo `placeId`. Resolver
  actor adentro (`resolveLibraryViewer`) y filtrar resultados por
  categorías legibles. `findLibraryItemForMention` → si no legible,
  comportarse como "no encontrado" (no leak de título).
- `courses/mark-item-completed.ts` + `unmark` + `listCategoryItemsForPrereqLookup`:
  `assertCategoryReadable` antes de operar.
- Tests por action.

### S4 — ✅ Migración escrita (NO aplicada — bloqueada por harness)

**Resultado**: `prisma/migrations/20260515000000_library_read_scope_rls/`
— helper `is_in_category_read_scope` (espeja `canReadCategory ||
canWriteCategory`, mismo patrón SQL que la policy write existente) +
reescritura de la policy SELECT preservando blind-write (author) y
audit (admin). **Cierra la contradicción activa** de los ADR 2026-05-04
/ 2026-05-12 (especificaban este RLS, nunca implementado).

**NO aplicada a cloud**: aplicar (`migrate deploy`/MCP) + `pnpm
test:rls` es deploy con blast radius (requiere OK explícito) Y está
**bloqueado por deuda preexistente**: el harness RLS de library
(`tests/rls/harness.ts`) usa `contributionPolicy::"ContributionPolicy"`

- `LibraryCategoryContributor`, ambos DROPEADOS en `20260513000000`. El
  test RLS read-scope no se puede escribir/correr hasta repararlo.
  Registrado como follow-up en el ADR. Decisión "incremental-escrito":
  policy escrita ahora, activación runtime holística pre-launch.

### S4 — Plan original (referencia)

- NEW migración: helper SQL `is_in_category_read_scope(category_id,
user_id)` (espeja la lógica de `canReadCategory`: owner, PUBLIC,
  pivotes group/tier/user, write-implica-read) + reescribir policy
  `LibraryItem_select_*` y agregar policy SELECT de `LibraryCategory`
  por read-scope.
- NOTA: el slice consulta con service-role (bypassa RLS) → este RLS
  solo protege accesos directos / clientes RLS-aware futuros. Es
  backstop real pero NO sustituye S2/S3. Documentar el límite.
- Verificación: tests SQL de la policy (patrón de `__tests__` RLS
  existentes si los hay) o script de verificación manual.

### S5 — ✅ EJECUTADA (ADR + auditoría + follow-ups)

**Resultado**: NEW ADR `2026-05-15-rls-incremental-write-holistic-activate.md`
— supersede parcialmente `2026-05-01` (separa "escribir+testear
incremental" de "activar holístico"), reconcilia la contradicción
activa, documenta asimetría admin + write-implica-read, registra 4
follow-ups (switch runtime pre-launch, harness desincronizado, punto 7,
ADRs a marcar históricos). Auditoría de datos corrida (1 categoría
no-PUBLIC, segura, sin backfill). Plan A cerrado.

### S5 — Plan original (referencia)

- Query (Supabase MCP, solo lectura): `LibraryCategory WHERE
readAccessKind != 'PUBLIC'` + conteo de pivotes. Reportar categorías
  que quedarían inaccesibles (no-PUBLIC con pivotes vacíos) — decidir
  con el owner si se corrigen manualmente antes de activar S2.
- ADR `2026-05-15-library-read-access-enforcement.md`: decisiones A–F,
  el límite RLS/service-role, write-implica-read.
- Actualizar ADR `2026-05-12` (sección RLS "deferida" → "implementada").

## Regla de oro

Cero regresión. El riesgo #1 es romper a contributors sin read-scope
(mitigado por decisión B). El riesgo #2 es romper categorías PUBLIC
(mitigado: default seguro, S5 audita). Cada sesión: TDD, typecheck +
suite verde, commit aislado. No se toca el patrón write existente
(consolidado). El helper S1 es additive; nada se cablea hasta S2.

## Orden / dependencias

S1 → S2 → S3 (S2/S3 dependen del helper S1). S4 independiente (puede ir
en paralelo conceptual pero commit aparte). S5 antes de activar S2 en
prod (la auditoría de datos debe correr y revisarse con el owner).

**LOC estimado**: S1 ~190, S2 ~250, S3 ~200, S4 ~150, S5 ~120 (ADR+audit).
Total ~910, 5 commits. Ningún archivo supera 300 LOC.
