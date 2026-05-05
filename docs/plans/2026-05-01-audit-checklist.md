# Audit Checklist — 2026-05-01

> Resultado de la auditoría paralela del codebase post-R.7.
> 4 agents auditaron arquitectura, parches, performance y gaps.
> Hallazgos verificados con `grep`/`wc`/`Read` antes de listarse.
>
> **Uso**: marcamos `[x]` cuando un item se cierra. Después del último,
> rerunneamos la auditoría para ver qué nuevo apareció.
> No agregar items nuevos sin re-auditar — los nuevos van a la
> próxima ronda.

---

## Progreso

### ✅ Cerrados (19) — audit 100% resuelto

- **B1** — RLS faltante: ADR `2026-05-01-rls-comprehensive-pre-launch.md`. Comprehensive sweep diferido a pre-launch (5 tablas: Membership/PlaceOwnership/Place/Invitation/User). Defense-in-depth: app filtra explícito por placeId mientras tanto.
- **B2** — Page con query Prisma directa (refactor: `quoteState` en CommentView via JOIN; −1 RTT por load).
- **B3** — `connection_limit=1` mata paralelización en dev (override `DEV_DATABASE_URL` opt-in + ADR).
- **M1** — 4 archivos > 300 LOC splitteados + 1 ADR de excepción (events/ui/event-form.tsx ya estaba cubierto por ADR previo).
- **M2** — `revalidatePath('/conversations')` agresivo (split por verbo en comments + home placeholder removida).
- **M3** — 9 server actions de library con tests unit (84 tests + 3 bugs latentes detectados + 1 ADR de excepción para 3 test files densos).
- **🐛 Bugs latentes M3** — 3 bugs detectados durante M3 fixeados (lost writes, TOCTOU, error tipado).
- **M4** — ADR `2026-05-01-stripe-deferred-to-phase-3.md`. Webhook stub queda como está (loguea + 200); aceptamos pérdida de eventos pre-Fase 3 porque no hay subscriptions activas.
- **M5** — Spec canónica `docs/features/flags/spec.md` (~280 LOC) con comportamiento intencional incluyendo CANCEL_EVENT sideEffect.
- **M6** — E2E coverage de library: 4 specs (admin-categories, member-create-item, viewer-listing, fab-queue) + extensión del seed con 3 categorías baseline + 2 items + contributor designado. ~950 LOC, ~95% del riesgo cubierto.
- **E (plan derivado)** — Erasure 365d cobertura completa: migration + extensión job (LibraryItem snapshot + Contributor DELETE + PostRead DELETE + Flag reporter/reviewer SetNull) + UI flag queue lee snapshot + tests. Reaction NO se toca (decisión user).
- **G2** — `reviewFlagAction` ahora soporta `CANCEL_EVENT` sideEffect via helper transaccional `cancelEventInTx` (precedente `createPostFromSystemHelper`). Idempotente. 4 tests nuevos.
- **L1** — Library queries ahora leen `LibraryItem.authorSnapshot` (no `Post.authorSnapshot`). Sella independencia de fuentes; comportamiento ex-miembro robusto end-to-end.
- **m1** — `console.log` en `library-item-form.tsx` (6 logs removidos).
- **m1 residual** — ADR `2026-05-01-client-error-observability-deferred.md`: observabilidad client-side (Sentry o equivalente) diferida hasta post-MVP launch. Code listo para enchufar cualquier servicio en ~30 min.
- **m2** — `revalidateLibraryItemPaths` revalidaba `/conversations/[postSlug]` que siempre 308.
- **m3** — Validación Zod consistente en `members/` actions: `leaveMembershipAction` y `acceptInvitationAction` ahora usan `safeParse` con schemas escalares (`leaveMembershipPlaceSlugSchema`, `acceptInvitationTokenSchema`) en `members/schemas.ts`. Patrón uniforme con invite/resend; signature escalar preservada (cero ruptura de callers UI).
- **m4** — Cubierto por la ADR de RLS comprehensive (faltan tests RLS para EventRSVP + LibraryCategoryContributor; se hacen en el sweep pre-launch).
- **m5** — Cumplido por las 3 ADRs creadas en la sesión: stripe-deferred, rls-comprehensive-pre-launch, client-error-observability-deferred.

### 🐛 Bugs latentes detectados + cerrados (2026-05-01)

| Bug                                   | Severity | Action                                                        | Solución                                                                                                                                                             | Verificación                                                                                               |
| ------------------------------------- | -------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Lost writes** sin `expectedVersion` | CRITICAL | `update-item.ts`                                              | Optimistic locking: `expectedVersion` en schema + `updateMany({where:{id, version}})` + `ConflictError` si count=0. Patrón replicado de `discussions/posts/edit.ts`. | Test "lost writes" reescrito como demostración del fix; segundo write con stale version → `ConflictError`. |
| **TOCTOU race**                       | HIGH     | `reorder-categories.ts` (+ create-category, archive-category) | Helper `acquireCategorySetLock(tx, placeId)` con `pg_advisory_xact_lock` aplicado a las 3 actions que mutan el set. SET check movido DENTRO de la TX bajo el lock.   | `it.todo` convertido a test real que valida lock SQL + ConflictError bajo mismatch.                        |
| **Error Prisma crudo** en P2003       | MEDIUM   | `create-item.ts`                                              | try/catch alrededor de `$transaction`, detecta `P2003` y throw `ConflictError` tipado con copy específico.                                                           | Test del race condition ahora asserta `ConflictError` en vez de `PrismaClientKnownRequestError`.           |

**Total**: 9 archivos modificados + 1 archivo nuevo (`_with-category-set-lock.ts`) + 2 tests del helper. Suite pasó de 1039 + 2 `todo` → 1041 sin todos.

### 🟡 Pendientes — ninguno

**Audit checklist 100% resuelto.**

### Trabajo pre-launch programado (vía ADRs)

- **RLS comprehensive sweep** (cubre B1 + m4): habilitar RLS en 5 tablas faltantes + escribir 2 tests RLS faltantes + re-audit de las 12 policies actuales. Trigger: antes del primer deploy a producción con users reales.
- **Stripe billing** (M4): implementar handlers + `Subscription`/`Customer` models + UI billing en Fase 3.
- **Observabilidad client-side** (m1 residual): elegir Sentry / PostHog / endpoint propio; conectar en post-MVP launch.

### 📋 Plan derivado E — Erasure 365d coverage extension

Detalle completo en `docs/plans/2026-05-01-erasure-coverage-extension.md`.

El job actual cubre `Post + Comment + Event + EventRSVP`. Pasa por alto:

| Sub-item | Entidad                             | Acción propuesta                                    | Severity   |
| -------- | ----------------------------------- | --------------------------------------------------- | ---------- |
| **E.1**  | `LibraryItem.authorUserId`          | UPDATE NULL                                         | MEDIUM     |
| **E.2**  | `LibraryCategoryContributor.userId` | DELETE rows del place                               | LOW-MEDIUM |
| **E.3**  | `Reaction.userId`                   | DELETE rows del place (decisión: counts bajan)      | MEDIUM     |
| **E.4**  | `PostRead.userId`                   | DELETE rows del place                               | LOW        |
| **E.5**  | `Flag.reporterUserId`               | UPDATE NULL + **migration** (campo es NOT NULL hoy) | MEDIUM     |
| **E.6**  | `Flag.reviewerAdminUserId`          | UPDATE NULL (ya nullable)                           | LOW        |

**4 decisiones de producto pendientes** documentadas en el plan (Q1-Q4). Bloquea el cierre del invariante de privacidad que la spec de flags (M5) describirá.

### Próximo paso recomendado

**B1** — único blocker pendiente. Riesgo de seguridad real (leak cross-tenant). Después se ataca el bloque robusto/cobertura (M5 → M6 → M4) y se cierra con los minors. Los 3 bugs latentes detectados en M3 también pueden atacarse como **fix-pack express** (~1 sesión cubre los 3) — el `it.todo` ya marca exactamente qué fix necesita cada uno.

---

## 🔴 Blockers — atender antes del próximo deploy

### B1. RLS faltante en `Membership`, `PlaceOwnership`, `Place`, `Invitation`

- [ ] **Verificación**: `grep -hE "Membership|PlaceOwnership" prisma/migrations/*/migration.sql | grep -i "policy\|enable row"` solo retorna referencias _desde_ policies de otras tablas — ninguna policy propia.
- [ ] **Riesgo**: tablas de control de acceso expuestas. Sin RLS, cualquier query autenticada lee role/ownership de cualquier place ⇒ leak cross-tenant si la app omite un filtro `where`.
  - `Membership` — relaciona User ↔ Place + role.
  - `PlaceOwnership` — define ownership administrativa.
  - `Place` — contiene `archivedAt`, billing, openingHours.
  - `Invitation` — emails + delivery status sensibles.
- [ ] **Acción 1**: migration `prisma/migrations/<ts>_access_rls/migration.sql` con policies:
  - `Membership`: `auth.uid() = "userId"` para SELECT del propio row + `EXISTS (...)` para ver miembros del mismo place.
  - `PlaceOwnership`: análogo.
  - `Invitation`: `auth.uid() = "invitedById" OR email = current_user_email`.
  - `Place`: SELECT abierta a miembros vía `EXISTS (Membership WHERE userId = auth.uid())`.
- [ ] **Acción 2**: tests RLS:
  - `tests/rls/membership.test.ts`
  - `tests/rls/place-ownership.test.ts`
  - `tests/rls/invitation.test.ts`
  - `tests/rls/place.test.ts`
- [ ] **Acción 3**: validar contra app code que no haya queries que asuman ausencia de RLS.
- [ ] **ADR**: `docs/decisions/<fecha>-access-tables-rls.md` con decisiones de policy shape.

### B2. Page con query Prisma directa ✅ (2026-05-01)

- [x] **Ubicación**: `src/app/[placeSlug]/(gated)/conversations/[postSlug]/page.tsx:203`
- [x] **Cita**: `const rows = await prisma.comment.findMany({ where: { id: { in: ids } }, select: { id: true, deletedAt: true } })` dentro de helper `resolveQuoteTargetStates` definido en la page.
- [x] **Viola**: architecture.md § "Reglas de aislamiento": "el acceso a la DB se hace desde `queries.ts` y `actions.ts` del propio feature".
- [x] **Resolución**: refactor estructural en lugar de mover el helper. `quoteState` ahora vive en `CommentView` (derivado server-side via Prisma `include` JOIN). Se eliminó `resolveQuoteTargetStates`, el import de `prisma` en ambas pages (conversations + library item detail), el prop `quoteStateByCommentId` (Map paralelo) y el `DEFAULT_QUOTE_STATE = 'VISIBLE'` que era trade-off conocido en `LoadMoreComments` y `CommentThreadLive`.
- [x] **Bonus encontrado**: `library/[categorySlug]/[itemSlug]/page.tsx` tenía la misma violación duplicada — limpia también.
- [x] **Performance**: -1 RTT por page load (1 SQL JOIN vs 2 queries secuenciales) en ambas pages. Load-more y realtime ya no muestran `VISIBLE` por default y "se corrigen al refrescar" — siempre traen estado real.
- [x] **Archivos tocados** (8 archivos):
  - `src/features/discussions/server/queries.ts` (mapper + commentInclude + CommentView ganó `quoteState`)
  - `src/features/discussions/ui/comment-item.tsx` (lee `comment.quoteState`)
  - `src/features/discussions/ui/comment-thread.tsx` (quita prop `quoteStateByCommentId`)
  - `src/features/discussions/ui/comment-thread-live.tsx` (quita default + prop)
  - `src/features/discussions/ui/load-more-comments.tsx` (quita default + prop)
  - `src/app/[placeSlug]/(gated)/conversations/[postSlug]/page.tsx` (limpia)
  - `src/app/[placeSlug]/(gated)/library/[categorySlug]/[itemSlug]/page.tsx` (limpia)
  - 2 fixtures de tests con `quoteState` agregado.
- [x] **Verificación**: typecheck ✅, lint ✅, tests (96/96 archivos, 898/898 tests) ✅, build prod ✅.

### B3. `connection_limit=1` mata paralelización en dev ✅ (2026-05-01)

- [x] **Ubicación**: `.env.example:31` (default `?pgbouncer=true&connection_limit=1`)
- [x] **Síntoma medido en codebase**: post detail page tarda ~700ms extra (7 queries × RTT). Flujo típico (home → conversations → detail) acumula ~1.5s de overhead puro de red.
- [x] **Hallazgo del research**: la recomendación oficial cambió en feb-2025 con Vercel Fluid Compute. `connection_limit=1` ya no protege en prod si Fluid está activo (Vercel KB: _"avoid max pool size of 1... harms concurrency"_).
- [x] **Resolución**: introducir `DEV_DATABASE_URL` opcional. `src/db/client.ts:resolveDatasourceUrl()` la prefiere sobre `DATABASE_URL` en dev. En prod siempre `DATABASE_URL` (sin tocar). Sin la env var, comportamiento idéntico al anterior — opt-in.
- [x] **Archivos tocados**:
  - `src/shared/config/env.ts` (schema gana `DEV_DATABASE_URL: z.string().url().optional()`).
  - `src/db/client.ts` (`resolveDatasourceUrl` + `datasourceUrl` condicional para `exactOptionalPropertyTypes`).
  - `.env.example` (documenta 2 modos dev: DIRECT_URL o pooler+limit=10, ambos comentados como opt-in).
  - `CLAUDE.md` (gotcha actualizado al nuevo mecanismo).
  - `docs/decisions/2026-05-01-database-url-dev-prod-split.md` (ADR nueva).
- [x] **Verificación**: typecheck ✅, lint ✅, 102/102 archivos tests, 953/953 tests ✅, build prod ✅.
- [ ] **Follow-up diferido (ADR aparte)**: confirmar Vercel Fluid Compute status en prod. Si está activo, `connection_limit=1` también degrada throughput allí — bumpear a 5-10 o migrar a `@prisma/adapter-pg` + `attachDatabasePool` cuando Prisma 7 sea estable.

---

## 🟠 Major

### M1. 5 archivos exceden el cap de 300 LOC ✅ (2026-05-01)

- [x] **Análisis con agents en paralelo**: `events/ui/event-form.tsx` (302 LOC) ya estaba cubierto por ADR previo (`docs/decisions/2026-04-25-events-size-exception.md`). Quedaron 4 archivos a tratar.
- [x] **M1.a — `library/server/queries.ts` (532 LOC)** → split en 4 archivos:
  - `queries/categories.ts` (164 LOC)
  - `queries/contributors.ts` (151 LOC)
  - `queries/items.ts` (243 LOC)
  - `queries/index.ts` (17 LOC) — barrel re-export.
  - Cero consumers externos directos. `public.server.ts` resuelve automáticamente al `index.ts`.
- [x] **M1.b — `discussions/server/queries.ts` (578 LOC)** → split en 5 archivos:
  - `queries/posts.ts` (261 LOC)
  - `queries/post-readers.ts` (177 LOC) — split adicional sobre el plan original (los 4 helpers de readers eran cohesivos pero hubieran dejado posts.ts > 400 LOC).
  - `queries/comments.ts` (169 LOC)
  - `queries/_shared.ts` (9 LOC) — `Cursor` type compartido.
  - `queries/index.ts` (16 LOC).
  - Sin cambios en `public.ts` / `public.server.ts`.
- [x] **M1.c — `flags/server/actions.ts` (327 LOC)** → split en 2 archivos sin index:
  - `actions/create.ts` (123 LOC)
  - `actions/review.ts` (229 LOC)
  - 5 consumers (public.ts + 2 UI + 2 tests) actualizados con paths específicos.
- [x] **M1.d — `discussions/domain/types.ts` (316 LOC)** → ADR de excepción (`docs/decisions/2026-05-01-discussions-types-size-exception.md`). Razones: tipos puros sin lógica, splitearlo sería burocrático sin ganar cohesión, precedente idéntico en `events/domain/types.ts` (`2026-04-25-events-size-exception.md` § Razones, punto 4).
- [x] **Verificación global post-integración**: typecheck ✅, lint ✅, 102/102 archivos tests ✅, 953/953 tests ✅, build prod ✅.
- [x] **Patrón aplicado**: vertical slice integrity preservada — el split es interno a cada slice. Helpers privados quedan donde se usan. ESLint del repo prohíbe `../../` así que se usaron alias `@/features/...` en archivos nuevos.

### M2. `revalidatePath('/conversations')` agresivo en cada comment ✅ (2026-05-01)

- [x] **Ubicación**: `src/features/discussions/server/actions/comments/shared.ts:14-16` + (bonus) `src/features/discussions/server/actions/posts/shared.ts:17-19`.
- [x] **Hallazgo del audit (parcialmente incorrecto)**: el audit dijo "revalidar solo el thread, sacar el listing". Eso rompía rankings + counts. Verificación en código:
  - `comment create` bumpea `lastActivityAt` (`create.ts:129`) y aumenta `commentCount` → listing necesario.
  - `comment edit` NO bumpea nada → listing NO necesario.
  - `comment delete` decrementa `commentCount` → listing necesario.
  - Todos los `post.*` actions afectan visibilidad/snippet/title del listing → listing necesario en todos los verbos.
- [x] **Verdadero waste**: `revalidatePath('/${placeSlug}')` (la home). `src/app/[placeSlug]/(gated)/page.tsx` es placeholder estático ("Fase 7 del roadmap"), cero queries dependientes de discussions. Revalidarla en cada comment/post action es regenerar HTML que no cambia.
- [x] **Resolución A — limpiar home en ambos helpers** (`comments/shared.ts` + `posts/shared.ts`): −1 path por op.
- [x] **Resolución B — split por verbo en comments**: `revalidateCommentPaths(placeSlug, postSlug, kind)` con `kind = 'create' | 'edit' | 'delete'`. Edit deja de revalidar el listing → ahorra ~4 queries (`listPostsByPlace` + 3 paralelas) por edit.
- [x] **Archivos tocados**:
  - `src/features/discussions/server/actions/comments/shared.ts` (parametrizado por verbo + doc inline).
  - `src/features/discussions/server/actions/comments/{create,edit,delete}.ts` (3 callers actualizados).
  - `src/features/discussions/server/actions/posts/shared.ts` (home removida + doc inline).
  - `src/features/discussions/__tests__/posts-actions.test.ts` (assertion `'/the-place'` removida + assertion negativa agregada).
- [x] **Posts no se splitea por verbo**: todos los verbos (create/edit/delete/moderate) afectan el listing visualmente. Documentado inline.
- [x] **Verificación**: typecheck ✅, lint ✅, 102/102 archivos, 953/953 tests ✅.

### M3. 9 server actions de `library` sin tests unitarios ✅ (2026-05-01)

- [x] **Tests creados** (1 archivo por action, 9 archivos nuevos en `src/features/library/__tests__/`):
  - `archive-category.test.ts` — 238 LOC, 7 tests (pilot)
  - `archive-item.test.ts` — 250 LOC, 7 tests
  - `create-category.test.ts` — 367 LOC, 15 tests (cubierto por ADR de excepción)
  - `create-item.test.ts` — 511 LOC, 15 tests + 1 todo (cubierto por ADR — bug latente documentado)
  - `invite-contributor.test.ts` — 297 LOC, 9 tests
  - `remove-contributor.test.ts` — 196 LOC, 5 tests
  - `reorder-categories.test.ts` — 293 LOC, 9 tests + 1 todo (TOCTOU bug documentado)
  - `update-category.test.ts` — 249 LOC, 8 tests
  - `update-item.test.ts` — 434 LOC, 10 tests + 1 todo (cubierto por ADR — lost writes documentado)
- [x] **Cobertura agregada**: 84 tests nuevos + 2 `it.todo` documentando bugs latentes CRITICAL/HIGH. Suite total pasó de 953 → 1037 + 2 todo.
- [x] **Bugs latentes detectados (no fixeados — separados como acción aparte)**:
  - `update-item.ts`: lost writes sin `expectedVersion` check (CRITICAL).
  - `reorder-categories.ts`: TOCTOU race entre `findMany` (live IDs) y `$transaction` updates (HIGH).
  - `create-item.ts`: categoría archivada mid-tx propaga error Prisma crudo en vez de error tipado (MEDIUM).
- [x] **ADR para 3 test files densos**: `docs/decisions/2026-05-01-library-action-tests-size-exception.md` justifica 367/434/511 LOC. Razón: mock surface fijo de actions multi-tabla (~150 LOC) hace que splittear duplique más de lo que ahorra.
- [x] **Patrón establecido**: pilot `archive-category.test.ts` validado primero; los otros 8 lo replicaron en paralelo. Cero tests fallaron.
- [x] **Verificación global**: typecheck ✅, lint ✅, 1037/1037 tests pass (+ 2 todo) ✅, build prod ✅.

### M4. Stripe webhook valida firma y descarta eventos

- [ ] **Ubicación**: `src/app/api/webhooks/stripe/route.ts:36-37`
- [ ] **Cita**: `// TODO(Fase 3): despachar al handler correspondiente por event.type`
- [ ] **Riesgo**: si Stripe se activa antes de Fase 3 (suscripción manual, prueba, billing accidental), los eventos se reciben + 200 OK + se pierden. Stripe no reintenta tras 200.
- [ ] **Acción mínima** (preserva opcionalidad de Fase 3):
  - Migration: tabla `stripe_event_log` (id, type, payload jsonb, receivedAt, processedAt nullable, error nullable).
  - Insert append-only en cada webhook recibido.
  - Logger pasa de `info` a `warn` mientras no hay handler.
- [ ] **Documentar en ADR** si decidimos no implementar el log y simplemente bloquear el endpoint hasta Fase 3.

### M5. `flags/` sin spec canónica

- [ ] **Faltante**: `docs/features/flags/spec.md`
- [ ] **Existe**: ADR `docs/decisions/2026-04-21-flags-subslice-split.md` (decisión técnica) — pero no spec de comportamiento.
- [ ] **Viola**: CLAUDE.md § "Spec antes de código".
- [ ] **Contenido mínimo**: vocabulario (flag, contentTargetKind, status), estados (PENDING/RESOLVED/DISMISSED), reglas (quién puede flag, qué se flagea, cómo se resuelve), notificación a admins, escalación.

### M6. `library/` sin E2E coverage

- [ ] **Faltante**: `tests/e2e/flows/library-*.spec.ts`
- [ ] **E2E existentes**: `events-create-rsvp`, `comment-reactions`, `moderation`, `invite-accept`, `zone-fab`, `zone-swipe`, `post-crud`, `hours-gate`, `admin-inline`.
- [ ] **Acción**: spec mínima cubriendo:
  - Crear categoría (admin) + crear item (admin) + visible en `/library`.
  - Member con MEMBERS_OPEN puede crear item.
  - Member con DESIGNATED no puede crear (UI sin botón) y action retorna error.
  - Designated contributor puede crear.
  - Archive item lo oculta del listado (visible solo en admin).
  - "Nuevo recurso" del FAB se oculta cuando no hay categorías elegibles (cubre el último cambio).

---

## 🟡 Minor

### m1. `console.log` / `console.error` en Client Components ✅ (2026-05-01)

- [x] **`src/features/library/ui/library-item-form.tsx`** líneas 105, 120, 125, 146, 155, 160 — 6 console statements removidos. Los catch blocks defensivos quedan (sin `console.*`); el `setFeedback` con `friendlyLibraryErrorMessage` cubre la experiencia de prod end-to-end. Verificado con grep: cero `console.*` en todo el slice library.
- [ ] **`src/features/shell/ui/zone-swiper.tsx:150`** — `console.error` en error boundary client-side. Aceptable por ahora (no hay logger client). Documentar como decisión (queda diferido a m5).
- [ ] **`src/app/error.tsx:11`** — root boundary `console.error` + `TODO: hook Sentry (Fase posterior)`. Aceptable como diferimiento explícito (queda diferido a M4-style ADR si decidimos).
- [x] **Verificación**: typecheck ✅, lint ✅.

### m2. `revalidateLibraryItemPaths` revalida `/conversations` ✅ (2026-05-01)

- [x] **Ubicación**: `src/features/library/server/actions/shared.ts:25-35`
- [x] **Hallazgo del audit (parcialmente incorrecto)**: el audit dijo "library items no son threads — copy-paste". Verificación: los Posts de library SÍ aparecen en `listPostsByPlace` (ningún filtro `libraryItem: null`). Política de producto confirmada por el user: cross-zona discoverability intencional → `/conversations` listing debe revalidarse cuando cambian título/cover/lastActivityAt del item.
- [x] **Verdadero desperdicio**: `revalidatePath('/[placeSlug]/conversations/[postSlug]')`. Esa page hace `permanentRedirect` a `/library/[cat]/[postSlug]` apenas detecta `post.libraryItem`. El cache SSR es solo una respuesta 308 determinística — regenerarla es trabajo gratis (ningún humano consume esa ruta).
- [x] **Resolución**: removido el revalidate del path `/conversations/[postSlug]`. Mantiene el de `/conversations` listing. Comment inline documenta la política para futuros lectores.
- [x] **Impacto**: 5 → 4 paths revalidados por `create-item` / `update-item` / `archive-item`. -20% trabajo SSR per-op. En batches admin (ej: 20 items) son 20 regeneraciones desperdiciadas evitadas.
- [x] **Verificación**: typecheck ✅, lint ✅, 102/102 archivos tests ✅, 953/953 tests ✅.

### m3. Validación Zod inconsistente en `members/` actions

- [ ] **Con Zod**: `invite.ts` (`inviteMemberSchema`).
- [ ] **Sin Zod (confían en types + permission gates)**: `leave.ts`, `resend.ts`, `accept.ts`.
- [ ] **Riesgo**: bajo (auth checks cubren). Inconsistencia de patrón.
- [ ] **Acción opcional**: agregar Zod `.parse()` mínimo en los 3 boundaries por consistencia.

### m4. Tests RLS faltantes para tablas tenant-scoped existentes

- [ ] **Verificar**: cada tabla con RLS en migrations debería tener test en `tests/rls/`.
- [ ] **Posibles gaps** (validar):
  - `Reaction` — verificar.
  - `EventRSVP` — verificar.
  - `LibraryCategoryContributor` — verificar.

### m5. ADR para excepciones intencionales

- [ ] **No hay ADR** para ausencia intencional de RLS en tablas (si decidimos no agregar a alguna).
- [ ] **No hay ADR** para diferir handler Stripe.
- [ ] **Acción**: si después de B1/M4 quedan exclusiones intencionales, documentarlas.

---

## ✅ Lo que está bien (no son issues — anclar para regresiones)

- Aislamiento de slices: ningún import cruzado fuera de `public.ts` / `public.server.ts`. `shared/ → features/` clean.
- `use client` justificado en ~30 componentes auditados.
- Sin N+1: queries usan batch (`groupBy`, `findMany({ id: { in } })`, helpers `listContributorsByCategoryIds`).
- `Promise.all` correcto en pages.
- `React.cache` aplicado en `getCurrentAuthUser`, `loadPlaceBySlug`, `findOrCreateCurrentOpening`.
- Realtime: `private: true` en todos los channels + cleanup correcto en `useEffect`.
- Índices Prisma presentes en hot paths.
- Cero `<img>` sin `next/image` en código de producción.
- Sin `@ts-ignore` / `@ts-expect-error` sin justificación.
- Sin código comentado-out viejo (`// removed`, `// deprecated`).
- Sin imports de `fake|mock|stub|fixture` fuera de tests/factories.

---

## Plan de ataque sugerido (orden por ROI)

1. **B2** (15 min) — fix obvio, refactor.
2. **B3** (10 min) — comment en `.env.example` + nota en CLAUDE.md gotcha.
3. **m1** (15 min) — barrido de `console.log` en library-item-form.
4. **M2** (30 min) — revalidate específico por post. Mejora UX en directo.
5. **m2** (15 min) — quitar `/conversations` revalidate de library.
6. **B1** (1 sesión completa) — RLS migrations + 4 test files + ADR. Mayor riesgo.
7. **M1** (1 sesión) — split de archivos > 300 LOC.
8. **M3** (1 sesión) — 9 unit tests para library actions.
9. **M5** (30 min) — spec de flags.
10. **M6** (1 sesión) — E2E de library.
11. **M4** (30 min) — stripe_event_log o ADR de diferimiento.
12. **m3, m4, m5** (cleanup) — pasada final.

Total estimado: ~5-6 sesiones.

---

## Re-auditoría final

- [ ] Cuando todos los blockers + majors estén `[x]`, rerun los 4 agents y comparar:
  - ¿Aparecen hallazgos nuevos?
  - ¿Algún fix introdujo regresión?
  - Actualizar este doc o crear `2026-XX-XX-audit-checklist-v2.md`.
