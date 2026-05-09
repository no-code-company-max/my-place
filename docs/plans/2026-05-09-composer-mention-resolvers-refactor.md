# Plan — Composer Mention Resolvers Refactor (Cleanup)

**Fecha:** 2026-05-09
**Predecesor:** Fase 1 perf (commits `bb2d369..1c6e9df`) + ADR `docs/decisions/2026-05-08-sub-slice-cross-public.md`
**Tipo:** Cleanup / housekeeping — NO requiere ADR.
**Estado:** Plan vigente — pendiente de ejecución por sub-fase.

## Context

Los 4 wrappers client del sub-slice `discussions/composers/` —que adapta los Composers Lexical (`rich-text/composers/public`) a las Server Actions de cada slice dueño— construyen los **mismos 4 resolvers de mention** (`searchUsers`, `searchEvents`, `listCategories`, `searchLibraryItems`) con código copy-paste:

- `src/features/discussions/ui/comment-composer-form.tsx` (74 LOC)
- `src/features/discussions/ui/post-composer-form.tsx` (61 LOC)
- `src/features/discussions/ui/event-composer-form.tsx` (51 LOC)
- `src/features/discussions/ui/library-item-composer-form.tsx` (181 LOC)

Total ~367 LOC, de los cuales ~25 LOC × 4 = **~100 LOC** son la construcción idéntica de los 4 resolvers (imports + memo + arrow body). Cada wrapper repite los mismos 3 imports cross-slice (`members/public`, `events/public`, `library/public`) y el mismo memo:

```ts
{
  ;(placeId, searchUsers, searchEvents, listCategories, searchLibraryItems)
}
```

Dolor concreto:

- **Acoplamiento estructural a 3 slices ajenos repetido 4 veces.** Si `searchEventsByPlaceAction` cambia signature (ej: `(placeId, q, page?)`) hay que tocar los 4 wrappers — y olvidarse de uno produce un drift silencioso.
- **Onboarding de un trigger nuevo** (ej: `/poll`, `/file`) implica 4 PRs mecánicos.
- **Asimetría sutil hoy oculta**: `comment-composer-form.tsx` mapea explícitamente cada user (`rows.map((r) => ({ userId: r.userId, displayName: r.displayName, handle: r.handle }))`) — es **identity transform** (la action ya devuelve `{ userId, displayName, handle: string | null }`, exactamente `MentionUserResult`). El `.map` es ruido residual de la migración F.3 → F.4 y debe morir junto con la duplicación.
- **Asimetría real en la API del consumer**: `CommentComposer` toma los 4 resolvers como props **individuales** (`searchUsers`, `searchEvents`, …), mientras que `PostComposer`/`EventComposer`/`LibraryItemComposer` toman un único `composerResolvers: ComposerMentionResolvers`. El plan **no unifica esa API** del slice `rich-text/composers/` (queda fuera de scope — riesgo de regresión y churn cross-slice innecesario), pero el hook devuelve la shape `ComposerMentionResolvers` completa y el wrapper `comment-composer-form` desestructura para alimentar las props individuales. Esto absorbe la asimetría sin tocarla.

Lo que dejó pendiente la sesión que escribió este plan: ejecutar el refactor en una sola sesión focalizada (≤5 archivos modificados + 1 archivo nuevo), con tests existentes verdes.

## Scope cerrado

### Entra

1. Crear hook `useComposerMentionResolvers(placeId)` en `src/features/discussions/composers/use-composer-mention-resolvers.ts` que devuelve `ComposerMentionResolvers` ya memoizado contra `placeId`.
2. Migrar los 4 wrappers a consumir el hook:
   - `comment-composer-form.tsx`: desestructura el resultado del hook en las props individuales (`searchUsers`, `searchEvents`, `listCategories`, `searchLibraryItems`) y elimina el `.map` identity de users.
   - `post-composer-form.tsx`, `event-composer-form.tsx`, `library-item-composer-form.tsx`: pasan el resultado completo como `composerResolvers={...}`.
3. Agregar test de unidad mínimo del hook (estable, sin tocar Lexical) — ver § Verificación.
4. Verificación final con `pnpm typecheck && pnpm lint && pnpm test --run` y smoke estructural ANALYZE.

### Fuera

- **Unificar la API de props del slice `rich-text/composers/`** (mover `CommentComposer` a `composerResolvers` único). Es un cambio de superficie cross-slice con su propio test surface y churn — fuera de un cleanup intra-`discussions/`.
- **Exponer el hook fuera de `discussions/`**. Es intra-slice, **no se re-exporta** desde `discussions/composers/public.ts`. La superficie pública del sub-slice queda intacta (los 4 wrappers + `LibraryItemComposerFormProps`).
- **Cambiar el shape de `ComposerMentionResolvers`** (`mentions/public.ts`). Inviolable — es contrato de `MentionPlugin`.
- **Cambiar las Server Actions** de members/events/library. No se les toca.
- **Modificar `tests/boundaries.test.ts`**. Sigue verde sin cambios — el hook vive intra-slice.
- **Tocar el wizard `library/wizard/`**. Verificado: NO usa composers ni resolvers (`grep -n "Composer" src/features/library/wizard/**` → vacío).
- **Tocar `comment-composer-lazy.tsx`**. La firma `{ placeId, postId }` del wrapper lazy no cambia; lazy load sigue intacto.
- **Cualquier ADR**. Es housekeeping puro: extraer copy-paste de 4 archivos hermanos al patrón canónico (`useX(placeId)` que memoiza N callbacks contra `placeId`). No introduce paradigma nuevo.

## Decisiones cerradas

### D1 — Hook intra-slice en `discussions/composers/`, NO en `shared/`

**Rationale.** El hook importa de 3 slices ajenos: `members/public`, `events/public`, `library/public`. La regla de `architecture.md` § "Reglas de aislamiento" prohíbe explícitamente que `shared/` importe de `features/`. Por lo tanto, el hook **debe vivir dentro de un slice**. El slice orquestador natural es `discussions/` — ya es el dueño del sub-slice `discussions/composers/` que envuelve a los Composers Lexical y consume las acciones de los otros slices.

**Verificación de boundary.** El hook importará:

```ts
import { searchMembersByPlaceAction } from '@/features/members/public'
import { searchEventsByPlaceAction } from '@/features/events/public'
import {
  listLibraryCategoriesForMentionAction,
  searchLibraryItemsForMentionAction,
} from '@/features/library/public'
import type { ComposerMentionResolvers } from '@/features/rich-text/public'
```

Los 4 imports cruzan vía barrel raíz `public.ts` de cada slice (regla original del ADR `2026-05-08-sub-slice-cross-public.md`). `tests/boundaries.test.ts` lo acepta sin cambios.

### D2 — Ubicación: `src/features/discussions/composers/use-composer-mention-resolvers.ts`

**Rationale.** Tres alternativas evaluadas:

| Ubicación                                                 | Pros                                                                | Contras                                                                                                                                                       | Veredicto   |
| --------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `discussions/ui/use-composer-mention-resolvers.ts`        | Convive con los wrappers                                            | El sub-slice `composers/` ya existe (creado en F.4) y agrupa toda la cohesión de "Composers + sus dependencias"; `ui/` mezcla UI-core del slice con composers | Descartada  |
| `discussions/composers/use-composer-mention-resolvers.ts` | Vive donde vive el `public.ts` del sub-slice; cohesivo; intra-slice | Es un archivo `.ts` (no `.tsx`) entre `.tsx` wrappers                                                                                                         | **Elegida** |
| `discussions/hooks/use-composer-mention-resolvers.ts`     | Convención general                                                  | Nuevo directorio sólo para 1 hook; sub-slice composers ya cumple                                                                                              | Descartada  |

El sub-slice `discussions/composers/` hoy contiene solo `public.ts` (el barrel re-exportador). Sumar el hook adentro **no infla la superficie pública** (no se re-exporta desde `public.ts`), pero deja la cohesión "todo lo que es construcción de Composers vive bajo `composers/`" explícita.

**Naming**. `use-composer-mention-resolvers.ts` es descriptivo y plural. Alternativa `use-resolvers.ts` se descarta — demasiado genérica para grep histórico futuro.

### D3 — Shape del retorno: `ComposerMentionResolvers` exacto

**Rationale.** El tipo `ComposerMentionResolvers` (definido en `src/features/rich-text/mentions/ui/mention-plugin.tsx`, exportado vía `mentions/public.ts` y re-exportado por `rich-text/public.ts`) es:

```ts
type ComposerMentionResolvers = {
  placeId: string
  searchUsers: (q: string) => Promise<MentionUserResult[]>
  searchEvents?: (q: string) => Promise<MentionEventResult[]>
  listCategories?: () => Promise<MentionLibraryCategoryResult[]>
  searchLibraryItems?: (categorySlug: string, q: string) => Promise<MentionLibraryItemResult[]>
}
```

El hook devuelve **los 4 resolvers presentes** (no opcionales). Eso es estrictamente más restrictivo que el tipo (`searchEvents`, `listCategories`, `searchLibraryItems` son opcionales en el tipo) — TypeScript lo acepta porque "más campos definidos" es asignable a "campos opcionales". El `comment-composer-form` que hoy pasa los 4 (no sólo `searchUsers`) sigue funcionando exactamente igual.

### D4 — Mantener la asimetría `CommentComposer` (props individuales) vs los otros 3 (`composerResolvers`)

**Rationale.** Unificar requiere tocar `rich-text/composers/ui/comment-composer.tsx` + sus tests + el código histórico que pasa sólo `searchUsers` (back-compat F.3). Es un refactor de superficie cross-slice independiente con su propio scope y tests. Este plan **absorbe** la asimetría en el wrapper `comment-composer-form`:

```ts
const resolvers = useComposerMentionResolvers(placeId)
return (
  <CommentComposer
    placeId={placeId}
    onSubmit={onSubmit}
    searchUsers={resolvers.searchUsers}
    searchEvents={resolvers.searchEvents}
    listCategories={resolvers.listCategories}
    searchLibraryItems={resolvers.searchLibraryItems}
  />
)
```

Las refs son estables (memoizadas dentro del hook contra `placeId`). El `.map` identity de users desaparece. Si en el futuro alguien decide unificar la API de `CommentComposer` (separate ADR), el cambio en el wrapper es trivial.

### D5 — Eliminar el `.map` identity en users

**Rationale.** Hoy `comment-composer-form.tsx` hace:

```ts
const rows = await searchMembersByPlaceAction(placeId, q)
return rows.map((r) => ({ userId: r.userId, displayName: r.displayName, handle: r.handle }))
```

Verificación de la action:

```
src/features/members/server/actions/mention-search.ts:13:
): Promise<Array<{ userId: string; displayName: string; handle: string | null }>>
```

`MentionUserResult` (en `mention-plugin.tsx`) es `{ userId, displayName, handle?: string | null }`. La acción ya devuelve un superset compatible (los 3 campos requeridos). El `.map` no transforma nada. Se elimina junto con la duplicación: el hook devuelve la promesa de la action directamente.

### D6 — Memoización del hook: una sola dependencia (`placeId`)

**Rationale.** Las 4 callbacks dependen exclusivamente de `placeId` (las 4 actions reciben `placeId` como primer arg). El hook usa **un único `useMemo`** que devuelve el objeto `ComposerMentionResolvers` completo, con dep `[placeId]`. Eso garantiza:

- **Una sola alocación por re-render con mismo `placeId`** (objeto + 4 callbacks dentro del mismo memo).
- **Identidad estable**: las 4 props del Composer no cambian entre re-renders → `MentionPlugin` no re-instancia el typeahead ni invalida sus caches client-side (los `cachedUsers`/`cachedEvents`/`cachedCategories` documentados en `mention-plugin.tsx:127-130`).

Alternativa descartada: 4 `useCallback` separados + 1 `useMemo` agregador. Sintácticamente más cerca del código actual, pero produce 5 alocaciones por re-render para nada — la firma de las 4 callbacks NUNCA varía sin que `placeId` cambie.

### D7 — Cero exposición pública: el hook es intra-slice

**Rationale.** El hook NO se re-exporta desde `discussions/composers/public.ts`. Razones:

- Otro slice no necesita construir resolvers para Composers — los **wrappers** son la superficie pública.
- Mantener `public.ts` mínimo es regla del ADR `2026-05-08-sub-slice-cross-public.md` (cualquier export adicional al barrel es superficie heavy potencial).
- Si en el futuro el wizard `library/wizard/` o un slice nuevo necesita Composers + resolvers, **invocará un wrapper existente** (`PostComposerWrapper` etc.), no reconstruirá los resolvers. Si ese caso aparece, se promueve el hook a `public.ts` con un PR dedicado y rationale.

### D8 — Sin cambios en `tests/boundaries.test.ts`

**Rationale.** El hook vive intra-slice (no cross). Los imports cross-slice del hook ya están permitidos por la regla original (todos vía barrel raíz `public.ts` de cada slice ajeno). El test pasa sin tocarlo.

## Sub-fases

| Sub-id | Tema                                                                         | Sesiones                     | Deliverable                                                                                                                                                              |
| ------ | ---------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| H1     | Crear hook + test                                                            | 1                            | `discussions/composers/use-composer-mention-resolvers.ts` (nuevo, ≤80 LOC) + `discussions/composers/__tests__/use-composer-mention-resolvers.test.tsx` (nuevo, ≤120 LOC) |
| H2     | Migrar `comment-composer-form.tsx` (caso props-individuales + .map identity) | 1 (combinable con H3)        | wrapper consumiendo el hook; eliminado el `.map` identity                                                                                                                |
| H3     | Migrar los 3 wrappers `composerResolvers` (post/event/library-item)          | 1 (combinable con H2)        | 3 wrappers consumiendo el hook                                                                                                                                           |
| H4     | Verificación + commit                                                        | 1 (puede ser parte de H2/H3) | `pnpm typecheck && pnpm lint && pnpm test --run` verdes; ANALYZE smoke; commit en español                                                                                |

**Combinación recomendada.** El refactor cabe cómodamente en **una sola sesión focalizada** (4 archivos modificados + 1 hook nuevo + 1 test nuevo = 6 archivos, dentro del límite "≤5 archivos por sesión" salvo el test, que es deliverable del mismo cambio). Si por alguna razón se prefiere partir, H1 (hook + test) primero, H2+H3+H4 como segunda sesión.

## Critical files

### Modificados

- `src/features/discussions/ui/comment-composer-form.tsx` — pasa de ~74 LOC a ~40 LOC. Elimina los 4 `useCallback` + `.map` identity. Mantiene el `useCallback` de `onSubmit` (depende de `postId`, no de `placeId`).
- `src/features/discussions/ui/post-composer-form.tsx` — pasa de ~61 LOC a ~40 LOC. Elimina el `useMemo` de `composerResolvers`.
- `src/features/discussions/ui/event-composer-form.tsx` — pasa de ~51 LOC a ~30 LOC. Elimina el `useMemo` de `composerResolvers`.
- `src/features/discussions/ui/library-item-composer-form.tsx` — pasa de ~181 LOC a ~160 LOC. Elimina el `useMemo` de `composerResolvers` (mantiene toda la lógica de title/cover/submit).

### Nuevos

- `src/features/discussions/composers/use-composer-mention-resolvers.ts` (≤80 LOC). Hook React `'use client'` con un `useMemo` único contra `[placeId]`. Devuelve `ComposerMentionResolvers`.
- `src/features/discussions/composers/__tests__/use-composer-mention-resolvers.test.tsx` (≤120 LOC). 3 casos:
  1. Devuelve los 4 resolvers + `placeId` con la shape esperada.
  2. La identidad del objeto retornado es estable entre re-renders con el mismo `placeId` (`renderHook` + `rerender`).
  3. Cambia la identidad cuando cambia `placeId` (validación de la dep array).

  No mockea las Server Actions con `vi.mock` — los tests del comportamiento de las actions ya viven en sus slices respectivos. Mockea sólo lo necesario para que el módulo cargue (los actions se `vi.mock` con stubs vacíos para no invocar Prisma; las llamadas reales no se ejercitan en este test, sólo la **construcción** de las callbacks).

### NO se tocan (verificado)

- `src/features/discussions/composers/public.ts` (no se re-exporta el hook).
- `src/features/discussions/public.ts` (lite, sin cambios).
- `src/features/rich-text/composers/ui/*.tsx` (los 4 Composers Lexical no cambian — la asimetría `CommentComposer` queda).
- `src/features/rich-text/mentions/ui/mention-plugin.tsx` (tipo `ComposerMentionResolvers` no cambia).
- `src/features/members/public.ts`, `src/features/events/public.ts`, `src/features/library/public.ts` (no cambia su superficie).
- `tests/boundaries.test.ts` (regla satisfecha sin cambios).
- `src/features/discussions/ui/comment-composer-lazy.tsx` (firma de `CommentComposerForm` no cambia).
- `src/features/library/wizard/**` (verificado: no construye resolvers).
- `src/app/[placeSlug]/(gated)/conversations/new/page.tsx`, `.../library/[categorySlug]/new/page.tsx`, `.../library/[categorySlug]/[itemSlug]/edit/page.tsx`, `src/features/events/ui/event-form.tsx` (consumen los wrappers; las props no cambian).

## Helpers / patterns reusados

- **Patrón `useX(placeId)` que memoiza N callbacks contra una dep estable**: la memo única (no 4 `useCallback` separados) es la elección estándar cuando todos los callbacks comparten exactamente la misma dep.
- **Sub-slice intra-slice sin re-exportar**: precedente en `discussions/composers/public.ts` (Fase 1) — el sub-slice expone sólo lo necesario; helpers internos del sub-slice no entran al barrel. Se replica acá.
- **Tests de hooks con `renderHook` + identity check**: patrón usado en `discussions/__tests__/use-comment-realtime.test.tsx` (estructura de mocks similar). Copy-paste estructural OK.
- **`vi.mock` per-action con stubs vacíos** (no full mocks) para tests que sólo validan construcción de callbacks: patrón ya usado en otros tests del slice cuando el comportamiento real se cubre downstream.

## Riesgos + mitigaciones

| #   | Riesgo                                                                                                                                                        | Probabilidad | Impacto                                      | Mitigación                                                                                                                                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | El hook arrastra al cliente código pesado de `members/events/library` por barrel `public.ts` (Fase 1 podría haberlos limpiado pero no garantiza)              | Baja         | Bundle eager regresa a 394 kB                | El hook ya consume las **mismas Server Actions** que hoy consumen los 4 wrappers — neutral en bundle. Verificar con `ANALYZE=true pnpm build`: chunks de `/conversations/new` y `/library/.../new` ≤ baseline post-Fase 1. Smoke obligatorio en H4.              |
| R2  | Eliminar el `.map` identity introduce un bug si la action devuelve campos extra que el composer no espera                                                     | Muy baja     | Render glitch                                | Verificación estática: `MentionUserResult` define exactamente `{ userId, displayName, handle?: string \| null }` — la action retorna `{ userId, displayName, handle: string \| null }` sin campos extra. El `.map` es identity puro. Test del hook valida shape. |
| R3  | El `useMemo` único re-crea el objeto si React re-renderiza por padre (Strict Mode dobla los renders en dev)                                                   | Baja         | Re-renders innecesarios en dev               | El memo está keyed por `placeId` (string estable). Strict Mode no invalida memos. Test "identity estable entre rerenders" lo cubre.                                                                                                                              |
| R4  | Asimetría `CommentComposer` (props individuales) sigue requiriendo desestructurado en el wrapper — el cleanup queda parcial                                   | Baja         | Lectura del código no perfecta               | Documentado explícitamente como D4. Si en el futuro se unifica, requiere ADR aparte. La duplicación crítica (los 4 resolvers + 4 imports × 4 archivos) sí desaparece.                                                                                            |
| R5  | El test del hook intenta importar Server Actions y rompe sin Prisma mockeado                                                                                  | Media        | Test suite roja                              | `vi.mock` cada uno de los 4 paths cross-slice con stub vacío (`vi.fn()`). El test valida shape + identidad de callbacks, NO comportamiento de las actions.                                                                                                       |
| R6  | El reviewer humano lee "hook devuelve callbacks" y asume que las Server Actions se invocan en construcción del hook (no — se invocan dentro de las callbacks) | Baja         | Confusión de código                          | Comentario JSDoc explícito en el hook explicando: "devuelve referencias a Server Actions cerradas sobre placeId; las actions NO se invocan hasta que el composer las llama".                                                                                     |
| R7  | Cambiar 4 archivos en una sola sesión cruza el límite "≤5 archivos por sesión"                                                                                | Baja         | Violación de regla CLAUDE.md                 | 6 archivos totales (4 modificados + 1 hook + 1 test). El límite es "≤5 archivos modificados". Si se considera estricto, partir en H1 (hook + test) y H2-H4 (wrappers). Tests siempre se contabilizan junto al deliverable.                                       |
| R8  | El test del hook hace `renderHook` que requiere `@testing-library/react` configurado para hooks                                                               | Baja         | Test no compila                              | Patrón ya usado en `use-comment-realtime.test.tsx` — `renderHook` está disponible. Si por alguna razón no, fallback a un componente de prueba que renderiza el hook y expone el resultado vía ref.                                                               |
| R9  | Alguien mañana extrae el hook a `shared/hooks/` por "más reusable"                                                                                            | Media        | Boundary violation (`shared/` → `features/`) | Comentario JSDoc explícito en el hook: "NO mover a `shared/`: importa de 3 slices ajenos vía `public.ts` — `shared/` no puede importar de `features/` (ver architecture.md § Reglas de aislamiento)".                                                            |

## Verificación

### Por sub-fase

**H1 — Hook + test**:

- `pnpm typecheck`: verde. El tipo de retorno del hook satisface `ComposerMentionResolvers` exactamente.
- `pnpm lint`: verde. Sin imports residuales.
- `pnpm test --run src/features/discussions/composers/__tests__/use-composer-mention-resolvers.test.tsx`: verde. 3 casos passing.

**H2 + H3 — Migración de wrappers**:

- `pnpm typecheck`: verde. Las props pasadas a cada Composer (`searchUsers` individual en `CommentComposer`, `composerResolvers` único en los otros 3) siguen siendo type-safe.
- `pnpm lint`: verde. Imports de `searchMembersByPlaceAction`, `searchEventsByPlaceAction`, `listLibraryCategoriesForMentionAction`, `searchLibraryItemsForMentionAction` desaparecen de los 4 wrappers (los hace el hook ahora).
- `pnpm test --run src/features/discussions/`: verde (ningún test del slice cubre los wrappers directamente — se verificó: los tests de los Composers viven en `rich-text/composers/__tests__/`).
- `pnpm test --run src/features/rich-text/composers/`: verde. Los Composers no cambiaron de signature.
- LOC reportado de cada archivo ≤300 (todos quedan ≤160).

**H4 — Cierre + commit**:

- `pnpm typecheck && pnpm lint && pnpm test --run`: verde end-to-end.
- `ANALYZE=true pnpm build`: opcional pero recomendado para confirmar que ningún chunk eager regresó a 394 kB. Pages relevantes: `/conversations/new`, `/conversations/[postSlug]`, `/events/new`, `/library/[cat]/new`, `/library/[cat]/[item]/edit`. El First Load JS de cada uno ≤ baseline post-Fase 1 (sin regresión).
- Smoke manual:
  - Thread page: tap "Sumate a la conversación" → editor lazy aparece (~150ms) → tipear `@`, `/event `, `/library` → los 3 dropdowns funcionan (no quedan inertes).
  - `/conversations/new`: tipear `@`, `/event `, `/library` → idem.
  - Editar un library item: tipear los 3 triggers → idem.
  - Crear evento (que monta `EventComposerWrapper`): tipear los 3 triggers → idem.
- Commit en español: `refactor(discussions/composers): extraer useComposerMentionResolvers para deduplicar 4 wrappers` o equivalente, con cuerpo describiendo D1, D4, D5.

### Final consolidada

- Líneas eliminadas netas: ~80 LOC (4 wrappers × 20 LOC duplicados − ~80 LOC del hook + tests). Cambio neto modesto, pero el patrón de un solo sitio donde se construyen los resolvers es la ganancia real.
- Adding un trigger nuevo (`/poll`) en el futuro: 1 archivo modificado (el hook), no 4.
- Cambiar la signature de `searchEventsByPlaceAction`: 1 archivo modificado (el hook), no 4.

## Salvaguardas anti-regresión

### S1 — Verificar Fase 1 perf intacta

Antes y después del refactor, correr `ANALYZE=true pnpm build` y comparar el bundle de las pages canónicas (`/conversations`, `/conversations/[postSlug]`, `/events`, `/library`, `/m/[handle]`):

- El chunk Lexical (`6936` o equivalente) **NO debe aparecer** en pages de lectura (regresión de Fase 1).
- Las pages de creación/edición pueden mantener su tamaño pre-existente (no es target de este plan reducirlo).

Si alguna page de lectura regresa el chunk Lexical, **revertir y diagnosticar**: probablemente un import accidental del hook (que vive en `composers/`) en un archivo de lectura.

### S2 — El hook NO entra al barrel `public.ts`

Verificación visual del PR: `discussions/composers/public.ts` NO debe ganar líneas. Si hay una línea nueva que re-exporte el hook, rechazar.

### S3 — Test estático "identidad estable" del hook

El test "identity estable entre rerenders con mismo `placeId`" es la salvaguarda contra una refactorización futura que rompa la memoización (ej: alguien convierte el `useMemo` en un objeto inline). Si falla, los caches client-side del `MentionPlugin` (líneas 127-130 de `mention-plugin.tsx`) se invalidan en cada re-render → degradación de perceived perf en el typeahead. Test obligatorio en H1.

### S4 — Comentario inline anti-`shared/`

JSDoc en el archivo del hook explica por qué vive en `discussions/` y no en `shared/`. Línea 1-2 del archivo. Salvaguarda contra refactor "bien intencionado" de un agente futuro.

### S5 — `tests/boundaries.test.ts` queda intacto

No se modifica el test ni la regla. Si alguien intenta cambiarlo en el mismo PR, rechazar — es señal de que el hook se movió a una ubicación no permitida.

### S6 — Rollback trigger

Si tras el refactor algún E2E del thread page (`tests/e2e/flows/discussions-create-read.spec.ts` o similar) falla con "el typeahead no aparece" o "publicar comentario no funciona", revertir el commit. El refactor es zero-funcional — cualquier regresión funcional es bug del refactor mismo, no requirements changeados.

## Alineación con CLAUDE.md y architecture.md

- [x] **LOC caps respetados**: hook ≤80 LOC; test ≤120 LOC; cada wrapper post-refactor ≤160 LOC.
- [x] **Función ≤60 LOC**: el hook es un único `useMemo` con función body ≤30 LOC.
- [x] **Vertical slice respetado**: el hook vive intra-slice (`discussions/composers/`). No se crea slice nuevo.
- [x] **Boundary rule honrada**: D1 — el hook está en `discussions/`, importa de 3 slices ajenos vía `public.ts` (regla original del ADR `2026-05-08-sub-slice-cross-public.md`). `shared/` queda intocado.
- [x] **`shared/` no importa de `features/`**: D1 — el hook explícitamente NO se mueve a `shared/`. Comentario JSDoc lo blinda.
- [x] **Server Components por default**: N/A — los wrappers ya eran Client Components (`'use client'` por construcción de Composers Lexical). El hook hereda `'use client'`.
- [x] **Tipos estrictos, sin `any`**: el hook tipa explícitamente el retorno como `ComposerMentionResolvers`. Las callbacks heredan los tipos de las Server Actions.
- [x] **Validación con Zod para input externo**: N/A — el refactor no toca validación. Las Server Actions de members/events/library ya validan con Zod en su slice.
- [x] **Tailwind sólo layout/spacing**: N/A — el hook no renderiza UI.
- [x] **Spec-first**: este es un cleanup de duplicación, no una feature nueva. No requiere spec en `docs/features/`. No requiere ADR (housekeeping puro).
- [x] **Cozytech**: N/A — refactor invisible al usuario.
- [x] **Una sesión = una cosa**: el refactor cabe en una sesión focalizada (≤6 archivos). Si se prefiere partir, H1 + (H2-H4 combinadas) — partition explícita.
- [x] **TDD**: tests del hook se escriben antes de la implementación (H1).
- [x] **Verificación auto**: `pnpm typecheck && pnpm lint && pnpm test --run` antes de commit. Reporte de LOC de cada archivo tocado.
- [x] **Documentar decisiones**: este plan es la documentación. NO se crea ADR.
- [x] **Idioma**: comentarios y commit en español; código en inglés (`useComposerMentionResolvers`, `searchUsers`, etc.).

## Próximo paso

Ejecutar **H1 — crear hook + test** como primera unidad de trabajo. Es la pieza de mayor riesgo (test de identidad estable + tipado del retorno) y desbloquea la migración mecánica de los 4 wrappers en H2-H3. Si H1 cierra verde, H2+H3+H4 se combinan en una segunda sesión corta o, si el tiempo lo permite, en la misma. Commit final en español: `refactor(discussions/composers): extraer useComposerMentionResolvers para deduplicar 4 wrappers`.
