# Plan — Port G.3 atomic permissions al legacy

**Fecha:** 2026-05-09 (post-commit `5e4e596`, B.2c deployed)
**Estado:** Pendiente de aprobación
**Owner:** Maxi
**Origen:** Hallazgo del análisis B.4/B.5 (`docs/plans/2026-05-09-posts-comments-analysis.md`): el sub-slice tiene G.3 atomic permissions cableado, el legacy ejecutándose en prod NO. Deuda silenciosa: delegación de moderación via custom groups está rota.

---

## Sección 1 — Auditoría empírica del status real de G.3

### 1.1 Infraestructura G.3 ya deployada — VERIFICADA

**`hasPermission` función:** existe y está deployed.

- File: `src/features/members/server/permissions.ts:43`
- Re-exportada vía `src/features/members/public.server.ts:55`
- Cached con `React.cache`. Owner bypass + group lookup.
- **CRÍTICO**: comment in line 16-19 dice: "Estado post-cleanup C.3: la única vía a `true` (fuera del owner bypass) es membership a un grupo de permisos que contenga el permiso solicitado. El fallback legacy `membership.role === 'ADMIN'` fue eliminado junto con la columna `Membership.role` y su enum." → **No hay fallback. Custom group con permiso atómico es la única vía non-owner**.

**Permissions atómicos definidos** — 10 hardcoded en `src/features/groups/domain/permissions.ts:20-31`:

```ts
;'discussions:hide-post' |
  'discussions:delete-post' |
  'discussions:delete-comment' |
  'library:moderate-items' |
  'library:moderate-categories' |
  'events:moderate' |
  'flags:review' |
  'members:invite' |
  'members:block' |
  'members:resend-invitation'
```

**Modelo Prisma** — verificado en `prisma/schema.prisma`:

- `PermissionGroup`, `GroupMembership`, `GroupCategoryScope` declarados.
- Migrations DDL aplicadas: `20260502030000_permission_groups_schema/` + `20260503000000_redefine_is_place_admin_via_groups/` + `20260504000000_library_selected_groups_policy/`.

**Preset auto-generado** — verificado en `src/features/places/server/actions.ts:116-117`: cada `createPlaceAction` instancia un `PermissionGroup` con `name: ADMIN_PRESET_NAME` ("Administradores"), `isPreset: true`, `permissions: PERMISSIONS_ALL`.

**`findIsPlaceAdmin` (clave para entender el gap)** — `src/shared/lib/identity-cache.ts:58`:

```ts
prisma.groupMembership.findFirst({
  where: { userId, placeId, group: { isPreset: true } },
  ...
})
```

Solo matchea **preset group**. **NO** considera grupos custom con permiso atómico.

### 1.2 Call sites legacy que bypass G.3 — auditoría completa

**El gap real** (post-G.7) **NO** es "actor.isAdmin usa Membership.role legacy" (esa columna no existe). El gap es: **`actor.isAdmin` = `isOwner || findIsPlaceAdmin()` solo considera el preset group**, mientras que `hasPermission(...)` considera owner + cualquier grupo (preset o custom) que tenga el permiso atómico. Los call sites siguientes NO consultan grupos custom y por tanto un user con permiso atómico delegado vía custom group queda denegado.

| Path                                                | Función afectada                                                       | Permiso atómico que debería usar                                                                                         | Equivalente sub-slice          |
| --------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------ |
| `discussions/server/actions/posts/delete.ts:74-91`  | `authorizePostDelete` (chequea `actor.isAdmin` vía `canDeleteContent`) | `discussions:delete-post`                                                                                                | sí                             |
| `discussions/server/actions/posts/edit.ts:51`       | `if (!actor.isAdmin)` (admin-bypass del 60s window)                    | **NO existe** (per ADR §2: editar ajeno NO es delegable). Debería usar `findPlaceOwnership` directo (owner-only bypass). | sí                             |
| `discussions/server/actions/posts/edit.ts:95`       | `openPostEditSession` retorna `adminBypass`                            | **NO existe** (mismo razonamiento). Debe ser `isOwner`                                                                   | sí                             |
| `discussions/server/actions/posts/moderate.ts:50`   | `if (!canAdminHide(actor))`                                            | `discussions:hide-post`                                                                                                  | sí                             |
| `discussions/server/actions/comments/delete.ts:80`  | `canDeleteContent(actor, ...)`                                         | `discussions:delete-comment`                                                                                             | sí                             |
| `discussions/server/actions/comments/edit.ts`       | NO usa `actor.isAdmin` (spec §7: comments no tienen admin-edit).       | n/a                                                                                                                      | sub-slice idem                 |
| `discussions/server/actions/load-more.ts:68,79,114` | `actor.isAdmin` para incluir hidden/deleted en listing admin           | semánticamente alineado a `discussions:hide-post`. **Decisión needed** owner.                                            | sub-slice posts NO migró este  |
| `flags/server/actions.ts:159`                       | `if (!actor.isAdmin)` para `reviewFlagAction`                          | `flags:review`                                                                                                           | NO existe sub-slice            |
| `library/server/actions/archive-category.ts:46`     | `if (!actor.isAdmin)`                                                  | `library:moderate-categories` (con categoryId scope)                                                                     | sí                             |
| `library/server/actions/create-category.ts:53`      | idem                                                                   | `library:moderate-categories` (sin scope)                                                                                | sí                             |
| `library/server/actions/update-category.ts:49`      | idem                                                                   | `library:moderate-categories` (con categoryId scope)                                                                     | sí                             |
| `library/server/actions/reorder-categories.ts:38`   | idem                                                                   | `library:moderate-categories` (sin scope)                                                                                | sí                             |
| `library/server/actions/invite-contributor.ts:55`   | idem                                                                   | `library:moderate-categories` (con categoryId scope)                                                                     | sí                             |
| `library/server/actions/remove-contributor.ts:37`   | idem                                                                   | `library:moderate-categories` (con categoryId scope)                                                                     | sí                             |
| `events/server/actions/update.ts:56`                | `if (event.authorUserId !== actor.actorId && !actor.isAdmin)`          | `events:moderate`                                                                                                        | sí (orphan, 0 consumers)       |
| `events/server/actions/cancel.ts:49`                | idem                                                                   | `events:moderate`                                                                                                        | NO migrado al sub-slice editor |

**Total call sites de write action que requieren port:** 13 actions (4 discussions, 1 flags, 6 library, 2 events).

### 1.3 Estado del rollout original de G.3 — explicación honesta

**Hipótesis (B) confirmada**: G.3 fue una migración **incremental opt-in** que se completó en **algunos sub-slices nuevos** (creados durante el cleanup G.7 — commit `d02da57` "chore: cleanup G.7") pero **el legacy raíz original fue solo migrado al pattern `findIsPlaceAdmin` (preset only), no al pattern `hasPermission` (atomic)**.

**Conclusión**: G.3 está **deployed pero parcialmente cableado**. El owner-bypass y el preset-group-bypass funcionan correctamente desde G.7. La **delegación atómica vía custom group** está cableado en sub-slices orphan; el código que ejecuta producción NO honra la delegación.

### 1.4 Tests existentes — auditoría

**Sub-slice tests** (mockean ambos lookups):

- `discussions/posts/__tests__/posts-actions.test.ts:26-30` mockea `groupMembershipFindMany` (atomic lookup) **y** `groupMembershipFindFirst` (preset lookup). **Cubren el path G.3 atomic**.
- `library/admin/__tests__/{archive,create,update,reorder}-category.test.ts` análogo.

**Legacy tests**:

- `discussions/__tests__/posts-actions.test.ts:120` mockea solo `groupMembershipFindFirst` (preset lookup) — `groupMembership.findMany` NO está mockeado. Si el port introduce `hasPermission(...)` calls, los tests legacy van a fallar porque `groupMembership.findMany` retorna `undefined` → `groups.length === 0` → `hasPermission` retorna `false`.

**Implicancia para el plan**: cada sub-fase del port DEBE ampliar los mocks legacy con `groupMembershipFindMany` (default `[]` — preserva comportamiento), y agregar tests específicos del path "non-preset custom group" para cada permiso atómico portado.

---

## Sección 2 — Decisión de approach

### Análisis honesto del problema

El "deuda silenciosa" es **real pero menos catastrófica** de lo que el descubrimiento inicial sugería:

- **Owner bypass**: funciona en legacy ✓
- **Preset-group "Administradores" bypass**: funciona en legacy ✓
- **Custom group con permiso atómico delegado**: **NO funciona en legacy** ✗

Quien sí estaría siendo "afectado" hoy:
Owners que **crearon un grupo custom** (ej: "Moderadores") con permisos atómicos delegados (ej: `discussions:hide-post`) y le agregaron miembros NO-presets esperando que pudieran moderar. Esos miembros hoy reciben `AuthorizationError` en hide/delete/library/events actions.

**Magnitud real**: dependiendo de cuántos owners hayan creado grupos custom delegados, el impacto va de "0 users" (preventivo) a "deuda funcional silenciosa" (≥1 owner ya delegó).

### Approaches considerados

**A — Port G.3 al legacy (sin tocar sub-slice)**:

- Pros: cierra deuda HOY, riesgo acotado, reversible commit-por-commit, no shape changes.
- Cons: drift bidireccional persiste hasta B.4/B.5.

**B — Acelerar B.4/B.5 con reconciliación previa**:

- Pros: cierra deuda + consolida.
- Cons: 5-12h efectivas, alto riesgo (F.3 RichText regression + lazy realtime + CommentView shape + Audit #5), bloquea fix de seguridad.

**C — Borrar el sub-slice y solo portar G.3 al legacy**:

- Pros: descarga mental, fix de prod, ningún drift.
- Cons: pierde inversión sub-slice (~2400 LOC útiles), decisión arquitectónica grande (requiere ADR), mezcla concerns.

### Recomendación: **Approach A** — Port G.3 al legacy

**Razón principal**: el problema es de **seguridad funcional** (delegación de moderación rota silenciosamente). Mezclarlo con consolidación de sub-slices (B.4/B.5/C) o decisión arquitectónica (Approach C) **infla el riesgo y demora el fix**. Approach A:

1. Cierra el agujero funcional con cambios mínimos y reversibles.
2. Es independiente de B.3/B.4/B.5 — si después se decide consolidar, el legacy ya cumple G.3 y la migración es menos disruptiva.
3. Permite agregar tests específicos del path "custom group" SIN cambiar la arquitectura.
4. Respeta CLAUDE.md "Un prompt = una responsabilidad" y "Sin libertad para decisiones arquitectónicas".

**Trade-off aceptado**: drift bidireccional persiste hasta que B.4/B.5 se aborden por separado. Aceptable porque el drift "sub-slice tiene Audit #5 / F.3 / lazy realtime" no es deuda silenciosa de producción — es deuda muerta de código orphan.

---

## Sección 3 — Plan detallado del approach elegido (Approach A)

### Pre-flight (gates antes de empezar)

1. Confirmar el push: `git status` clean / branch dedicado `port-g3-to-legacy`.
2. Correr suite completa: `pnpm vitest run` y `pnpm typecheck` para baseline verde. Si falla algo, fix antes de comenzar.
3. **Pre-flight con MCP supabase** (recomendado): `SELECT COUNT(*) FROM "PermissionGroup" WHERE "isPreset" = false AND array_length(permissions, 1) > 0` para saber si la deuda es activa o preventiva.
4. Smoke local: `pnpm dev`, login como owner, verificar que hide/delete posts funciona (preset path).
5. Decisión owner sobre A4 (edit.ts strict vs minimal) y A6 (load-more semántica).

### Sub-fases — orden recomendado y razones

**Orden por riesgo creciente** (más simple/aislado primero):

| #   | Sub-fase                                                        | Files tocados          | Permiso                                                                 | Riesgo                           | Estimado |
| --- | --------------------------------------------------------------- | ---------------------- | ----------------------------------------------------------------------- | -------------------------------- | -------- |
| 1   | A1 — flags/server/actions.ts                                    | 1 src + 1 test         | `flags:review`                                                          | Bajo                             | 30 min   |
| 2   | A2 — events/server/actions/{cancel,update}.ts                   | 2 src + 1 test         | `events:moderate`                                                       | Bajo                             | 45 min   |
| 3   | A3 — library/server/actions (6 archivos)                        | 6 src + 1-6 tests      | `library:moderate-categories` (con scope)                               | Medio (scoped permission)        | 90 min   |
| 4   | A4 — discussions/server/actions/posts/{delete,moderate,edit}.ts | 3 src + 1 test         | `discussions:delete-post`, `discussions:hide-post`, ADR §2 owner-bypass | Medio                            | 90 min   |
| 5   | A5 — discussions/server/actions/comments/delete.ts              | 1 src + 1 test         | `discussions:delete-comment`                                            | Bajo                             | 30 min   |
| 6   | A6 — discussions/server/actions/load-more.ts (decision needed)  | 1 src + posibles tests | `discussions:hide-post` (semantic alignment)                            | Medio (decision pendiente owner) | 45 min   |
| 7   | A7 — Tests + docs + ADR addendum                                | tests / ADR            | n/a                                                                     | n/a                              | 60 min   |

**Total estimado**: ~6.5h de implementación + ~1.5h smoke + 1h buffer = ~9h.

### Pattern del cambio (común a A1, A2, A3, A4 delete/moderate, A5, A6)

```diff
+ import { hasPermission } from '@/features/members/public.server'

  const actor = await resolveActorForPlace({ placeId: ... })
- if (!actor.isAdmin) {
+ const allowed = await hasPermission(actor.actorId, actor.placeId, 'permission:atomic')
+ if (!allowed) {
    throw new AuthorizationError(...)
  }
```

### Caso especial — A4 edit.ts (decision needed)

Per ADR §2, "editar contenido ajeno NO es permiso atómico delegable". Sub-slice usa `findPlaceOwnership` directo (owner-only bypass). Si se aplica strict, **un user en preset group (NOT owner) ya no puede editar posts ajenos** — cambio semántico.

**Recomendación**: implementar la versión strict (alineada a ADR §2). Si owner objeta, fallback a no-op.

### Caso especial — A6 load-more.ts (decision needed)

Los flags `includeHidden`/`includeDeleted` se setean según `actor.isAdmin`. Mapeo natural a `discussions:hide-post` (visibility = moderation). Si owner OK, ir por G.3-aligned. Documentar decisión.

### Riesgos identificados con mitigación

| Riesgo                                                                                  | Probabilidad | Impacto | Mitigación                                                                                                                |
| --------------------------------------------------------------------------------------- | ------------ | ------- | ------------------------------------------------------------------------------------------------------------------------- |
| Tests legacy fallan post-port porque `groupMembership.findMany` no está mockeado        | Alta         | Bajo    | Default mock `[]` antes de cualquier cambio de gate. Sub-fase test-prep antes del cambio real.                            |
| Cambio semántico en edit.ts (preset ya no edita ajenos) sorprende al owner              | Media        | Medio   | Decisión documentada antes de A4. Si owner objeta, fallback a no-op. ADR addendum lo registra.                            |
| `findPlaceOwnership` ya cached pero `hasPermission` añade RTT extra                     | Baja         | Bajo    | `hasPermission` también cached con `React.cache`. RTT extra es 1 query indexada. Negligible para 150-member places.       |
| Sub-slice deja de ser "más nuevo" — confunde plan B.4/B.5                               | Media        | Bajo    | ADR addendum lo documenta. Plan B.4/B.5 ya conoce el drift. Post-port el drift se acota a Audit #5 / F.3 / lazy realtime. |
| Permiso atómico aplicado al lugar equivocado                                            | Baja         | Bajo    | Decisión documentada en pre-flight A6. Discriminated union testing en CI.                                                 |
| Smoke manual descubre regresión post-merge                                              | Media        | Alto    | Smoke section 4 obligatorio antes de cada merge a main. Rollback plan abajo.                                              |
| Performance: `hasPermission` agrega +13 RTT si todos los actions se invocan en paralelo | Baja         | Bajo    | `React.cache` deduplica. Las actions son single-call (no N+1).                                                            |
| Tests RLS / E2E rompen por shape change en GroupMembership query                        | Baja         | Medio   | RLS no toca `GroupMembership` schema. E2E smoke incluye flow custom-group del section 4.                                  |

### Rollback strategy commit-by-commit

Cada sub-fase es un commit aislado. Si una sub-fase falla en smoke o post-merge:

- **Fase Aᵢ revertible**: `git revert <hash-of-Ai>` y push. La fase deja la legacy en `actor.isAdmin` que es estado pre-port (preset/owner only). NO regresión funcional para users existentes (owners + preset members siguen operando).
- **Cierre parcial**: si A1-A4 mergean OK pero A5 falla, A1-A4 quedan deployed, A5 se trabaja aparte. Sigue siendo mejora vs estado actual.
- **Cancelación total**: `git revert <range>` desde main hasta el commit de A1. Estado idéntico al pre-plan.

NO se require migration de DB ni de seed data — `hasPermission` consulta tablas existentes con queries adicionales pero compatibles.

### Test plan integral

**Por sub-fase** (gate antes de commit):

1. `pnpm vitest run <path-de-feature>` verde.
2. `pnpm typecheck` verde.
3. `pnpm lint` verde.

**Pre-merge a main** (gate adicional):

1. `pnpm vitest run` (full suite) verde.
2. `pnpm test:rls` verde.
3. Smoke manual section 4 obligatorio.

**Post-merge** (monitoring):

1. Watch Vercel logs por errores `AuthorizationError` inesperados las primeras 24h.
2. Verificar via supabase MCP que no hay aumento de error rate en `pino` log stream.

---

## Sección 4 — Smoke check manual obligatorio

Diseñado para validar G.3 atomic delegation funciona post-port.

### Setup (una vez por place de prueba)

1. Login como **Owner** del place de smoke.
2. Verificar grupo preset existe: `/${slug}/settings/groups` → `Administradores` con `isPreset=true` y todos los permisos.
3. Crear **grupo custom A** "Moderadores Discusiones" con `discussions:hide-post`, `discussions:delete-post`, `discussions:delete-comment`.
4. Crear **grupo custom B** "Moderadores Library" con `library:moderate-categories` scopeado a 1 categoría específica.
5. Crear **grupo custom C** "Mod Eventos + Flags" con `events:moderate`, `flags:review`.
6. Invitar 3 members de prueba (User-A, User-B, User-C). Aceptar invitations.
7. Asignar User-A → grupo A; User-B → grupo B; User-C → grupo C.
8. NO asignar a ninguno al preset "Administradores".
9. Crear contenido de prueba: post + comment de Owner, evento, flag, categoría library.

### Smoke checklist (post-deploy preview)

#### A — Owner (control)

- [ ] Hide/unhide post propio y ajeno → ok.
- [ ] Delete post ajeno → ok.
- [ ] Delete comment ajeno → ok.
- [ ] Edit post ajeno → ok (owner siempre).
- [ ] Update / cancel evento ajeno → ok.
- [ ] Review flag → ok.
- [ ] Archive / update / create categoría library → ok.

#### B — User-A (custom group "Moderadores Discusiones")

- [ ] **CRÍTICO**: hide post ajeno → debe ser **OK** (era 403 pre-port).
- [ ] **CRÍTICO**: unhide post ajeno → ok.
- [ ] **CRÍTICO**: delete post ajeno → ok (era 403).
- [ ] **CRÍTICO**: delete comment ajeno → ok.
- [ ] Update evento ajeno → debe ser 403.
- [ ] Review flag → debe ser 403.
- [ ] Archive categoría library → debe ser 403.
- [ ] Edit post ajeno → debe ser 403 (ADR §2: NO delegable).
- [ ] **Audit log**: verificar que `pino` log de `postDeleted`/`postHidden` registró `actorId: user-A` y `byAdmin: true`.

#### C — User-B (custom group "Moderadores Library", scoped)

- [ ] Archive **categoría scopeada** → ok.
- [ ] Archive **categoría NO scopeada** → debe ser 403.
- [ ] Update categoría scopeada → ok.
- [ ] Reorder categorías → 403.
- [ ] Create categoría → 403.
- [ ] Invite contributor a categoría scopeada → ok.

#### D — User-C (custom group "Mod Eventos + Flags")

- [ ] Update evento ajeno → ok.
- [ ] Cancel evento ajeno → ok.
- [ ] Review flag → ok.
- [ ] Hide post → 403.
- [ ] Archive categoría → 403.

#### E — Email/UX flow (no-regression)

- [ ] Block member (como Owner) → email Resend llega.
- [ ] Expel member (como Owner) → email Resend llega.

#### F — RLS sanity (no-regression)

- [ ] Verificar que no hay 500 en preview por RLS al hacer las acciones de C/D/E.

### Criterio de pass/fail

- **Pass**: todos los checklists A-F verdes. Logs `pino` muestran `byAdmin: true` correcto.
- **Fail**: cualquier item CRÍTICO de B/C/D falla → rollback de la sub-fase responsable inmediato.

---

## Sección 5 — Cronograma estimado

| Fase                                                            | Trabajo                                                             | Tiempo                 |
| --------------------------------------------------------------- | ------------------------------------------------------------------- | ---------------------- |
| Pre-flight                                                      | Lectura plan, baseline tests, branch setup, pre-flight MCP supabase | 30 min                 |
| Decisión owner (edit.ts strict vs minimal, load-more semántica) | Sync de 15 min                                                      | 15 min                 |
| A1 — flags                                                      | Code + tests + smoke local                                          | 30 min                 |
| A2 — events                                                     | Code + tests + smoke local                                          | 45 min                 |
| A3 — library (split en a + b)                                   | Code + tests + smoke local                                          | 90 min                 |
| A4 — discussions/posts (split delete/moderate/edit)             | Code + tests + smoke local                                          | 90 min                 |
| A5 — discussions/comments/delete                                | Code + tests + smoke local                                          | 30 min                 |
| A6 — discussions/load-more                                      | Code + tests + smoke local                                          | 45 min                 |
| A7 — tests integrales + ADR + docs                              | Tests batch + ADR escritura                                         | 60 min                 |
| **Smoke section 4**                                             | Setup users + run all checklists en preview                         | **90 min**             |
| Buffer                                                          | Debugging, decisiones nuevas, gotchas RLS                           | 60 min                 |
| **TOTAL**                                                       |                                                                     | **~9 horas efectivas** |

**Splittable en**:

- Sesión 1 (3-4h): pre-flight + A1 + A2 + A3 (low/medium risk).
- Sesión 2 (3-4h): A4 + A5 + A6 + A7.
- Sesión 3 (1.5h): smoke section 4 obligatorio + merge.

---

## Sección 6 — Apéndice de asumidos y gaps

### Asumidos verificados

1. **Sub-slices `discussions/posts/`, `discussions/comments/`, `library/admin/`, `library/contributors/`, `events/editor/` están orphan**. Verificado con `grep`.
2. **Migrations G.3 deployadas en prod**: archivos existen en `prisma/migrations/`. NO verifiqué el cluster prod en read-only mode.
3. **`Membership.role` columna fue dropeada**: comment en `permissions.ts:18` lo confirma.
4. **`groupMembership.findFirst` con `isPreset:true` retorna correctamente**: tests del legacy ya lo mockean y pasan.

### Asumidos NO verificados (flagged)

1. **Cuántos places en prod tienen grupos custom delegados**. Si 0, el "fix" es preventivo. Si ≥1, deuda activa hoy. **Owner debería verificar via supabase MCP** con `SELECT COUNT(*) FROM "PermissionGroup" WHERE "isPreset" = false AND array_length(permissions, 1) > 0` antes de prioritizar.
2. **Smoke section 4 cubre todos los casos**. Casos edge no cubiertos: user en MÚLTIPLES grupos custom; user con grupo custom + también miembro del preset (override semántico).
3. **`load-more.ts` semántica**: asumí "ver hidden = `discussions:hide-post`". Decisión owner.
4. **Tests E2E (`tests/e2e/`)**: NO inspeccioné. Si hay tests E2E que esperan `actor.isAdmin === true ⇔ preset member`, podrían tener supuestos a actualizar.
5. **Library legacy actions tienen tests propios?** NO verifiqué. Si NO los tienen, los smokes de library en A3 son críticos.
6. **`update-item.ts:66`** menciona "viewer.isAdmin" en comentario. Verificar antes de incluirlo en scope. **Acción pre-flight A3**: leer completo y agregar a la lista si es bypass.

### Honesty: ¿Es esto deuda real o no-issue?

**Sí, es deuda real**, pero el impacto depende de adoption:

- Si ningún owner ha creado grupos custom delegados todavía: deuda **silenciosa** (potencial), no activa. Cerrar el gap es preventivo y razonable.
- Si ≥1 owner ya delegó: deuda **activa**, los moderadores de esos grupos no pueden moderar y reciben 403 sin saber por qué. Cerrar urgente.

**El feature G.3 fue diseñado para soportar esta delegación.** Que el código de UI de groups (CRUD) esté deployed pero los gates legacy no honren la delegación es un **gap funcional** real. NO es un problema teórico.

**Recomendación final**: pre-flight con MCP supabase: `SELECT COUNT(*) FROM "PermissionGroup" WHERE "isPreset" = false`. Si es 0, plan A baja a "preventivo" (mismo esfuerzo, menor urgencia). Si es ≥1, plan A es **alta prioridad**.

---

## Critical Files for Implementation

- `src/features/members/server/permissions.ts`
- `src/features/discussions/server/actions/posts/{delete,moderate,edit}.ts`
- `src/features/discussions/server/actions/comments/delete.ts`
- `src/features/library/server/actions/{archive,create,update,reorder}-category.ts` y `{invite,remove}-contributor.ts`
- `src/features/events/server/actions/{update,cancel}.ts`
- `src/features/flags/server/actions.ts`
- `src/features/discussions/server/actions/load-more.ts`

(Reference para patterns ya G.3-aware, NO se modifican):

- `src/features/discussions/posts/server/actions/{delete,moderate,edit}.ts`
- `src/features/library/admin/server/actions/archive-category.ts`
- `src/features/events/editor/server/actions/update.ts`
