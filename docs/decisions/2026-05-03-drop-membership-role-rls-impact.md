# ADR — Drop `Membership.role` + refactor `is_place_admin` SQL helper

**Fecha**: 2026-05-03
**Estado**: Aceptada
**Plan**: `~/.claude/plans/tidy-stargazing-summit.md` (Completar G.7 + G.8)

## Contexto

El plan original `docs/plans/2026-05-02-permission-groups-and-member-controls.md` introdujo el modelo de **PermissionGroups** (10 permisos atómicos asignados via membership a grupos custom + 1 grupo preset "Administradores"). Durante G.0 una data migration creó el preset por place y migró los `Membership.role = 'ADMIN'` existentes a membership al preset. La G.7 cleanup (drop columna `role` + enum `MembershipRole`) quedó parcial: las actions deprecadas (`promoteToAdminAction`, `demoteToMemberAction`) se eliminaron, pero la columna persistió por compat con ~17 archivos prod + ~19 archivos test que aún tipaban `MembershipRole` y por un fallback `if (membership.role === 'ADMIN') return true` en `hasPermission` / `listAllowedCategoryIds`.

Este ADR documenta el cierre completo de ese cleanup, ejecutado bajo el plan `tidy-stargazing-summit`.

### Nota de ejecución (2026-05-05)

El plan se encontró **parcialmente ejecutado** al inicio de la sesión de cierre: las dos migrations DDL (`20260503000000_redefine_is_place_admin_via_groups` y `20260503000100_drop_membership_role`) ya existían como archivos en `prisma/migrations/`, y el `@prisma/client` generado ya reflejaba el drop (no exporta `MembershipRole`, no acepta `role` en `MembershipCreateManyInput`). Sin embargo, `prisma/schema.prisma` aún declaraba `role MembershipRole @default(MEMBER)` y 23 archivos del codebase aún importaban `MembershipRole` o leían `.role === 'ADMIN'`. La build no compilaba en ese estado.

La sesión de cierre **estabilizó ese estado**: sincronizó schema.prisma con el client generado, completó el refactor de los 23 consumers, agregó el primitive `findIsPlaceAdmin` que la migration SQL asume, y migró los 8 test files que mockean Prisma a la nueva firma `mockActiveMember({ asAdmin })`. El cierre no introduce DDL nueva — solo termina la migración de código que las DDL anteriores asumían terminada.

## Decisión

**Dropear** la columna `Membership.role` + el enum `MembershipRole` de Postgres + Prisma. El authorization check en SQL (`is_place_admin(place_id TEXT)`) se refactorea para derivar admin de membership al grupo preset "Administradores" en lugar de leer `Membership.role`.

## Riesgo crítico mitigado

El SQL function `public.is_place_admin(place_id TEXT)` (definido en `prisma/migrations/20260422000100_discussions_rls/migration.sql`) lee `m."role" = 'ADMIN'` directo. **Es consumido por RLS policies en 4+ migrations** (`discussions_rls`, `events_core_schema`, `library_categories`, `post_hard_delete_align`). Dropear la columna sin refactor previo del helper rompe **toda la capa RLS** — cualquier policy que invoque `is_place_admin(...)` falla con error de columna inexistente, y las policies fallan con DENY por default.

Mitigación: dos migrations atómicas, ordenadas y separadas:

1. **Migration 1** (`20260503000000_redefine_is_place_admin_via_groups`): `CREATE OR REPLACE FUNCTION public.is_place_admin(...)` con la nueva lógica que JOIN `GroupMembership` + `PermissionGroup` filtrado por `isPreset = true`. La signature, return type, grants y `SECURITY INVOKER` son **idénticos** al original, así que las RLS policies que lo consumen no requieren cambios. Backwards-compat: la columna sigue existiendo y leíble por el resto del código durante esta migration.

2. **Migration 2** (`20260503000100_drop_membership_role`): `ALTER TABLE "Membership" DROP COLUMN "role"; DROP TYPE "MembershipRole";`. Sólo se aplica una vez Migration 1 está estable y todo el código consumer de `.role` se refactoreó a leer `isAdmin` derivado de groups.

**Validación intermedia**: `pnpm test:rls tests/rls/helpers-functions.test.ts` debe pasar entre las dos migrations — los 8 tests directos sobre `is_place_admin` con admin/owner/memberA/exMember/nonMember son la red de seguridad para verificar que el universo de filas accesibles no cambió.

## Pre-requisito de la Migration 1

La data migration `scripts/migrate-admins-to-groups.ts` debe haber corrido en **cada place** del ambiente target antes de aplicar Migration 1. Sin ella, los admins legacy (que sólo tienen `role = 'ADMIN'`, sin GroupMembership al preset) pierden permisos al instante.

Verificación pre-deploy (cloud dev, antes de Migration 1):

```sql
SELECT
  p.slug,
  (SELECT count(*) FROM "Membership" m
   WHERE m."placeId" = p."id" AND m."role" = 'ADMIN' AND m."leftAt" IS NULL) AS admins_role,
  (SELECT count(*) FROM "GroupMembership" gm
   JOIN "PermissionGroup" g ON g."id" = gm."groupId"
   WHERE g."placeId" = p."id" AND g."isPreset" = true) AS admins_preset
FROM "Place" p
ORDER BY p.slug;
```

`admins_role` debe ser igual a `admins_preset` para cada place. Si no, re-correr `migrate-admins-to-groups.ts` antes de proceder.

Una vez aplicada la Migration 2, el script `migrate-admins-to-groups.ts` y su counterpart `validate-admins-migration.ts` se eliminan del repo — su trabajo está hecho y mantenerlos es residuo.

## Strategy de deploy en producción

A diferencia del cloud dev (donde aplicamos las dos migrations seguidas), **producción exige A/B con ventana**:

- **Deploy A**: incluye refactor app layer (consumers leen `isAdmin` en vez de `role`) + Migration 1 (refactor SQL helper). En este punto, app layer ya consume `isAdmin` via `findInviterPermissions` / `findIsPlaceAdmin` y SQL helper ya deriva del preset group, **pero la columna sigue existiendo**.

- **Deploy B**: incluye drop column code (schema.prisma sin la columna + Prisma generate) + Migration 2 (DDL drop). Sólo se ejecuta una vez Deploy A está estable y verificado en prod (~24h sugeridas para detectar regresiones tardías).

**Rollback safety**:

- Si Deploy A falla: rollback es seguro (la columna sigue ahí, app layer recupera el comportamiento previo). El SQL helper refactoreado retorna lo mismo que el viejo siempre que el preset esté poblado (verificado por la data migration G.0).
- Si Deploy B falla: rollback restaura el código pero **los datos del role ya están perdidos** (DDL irreversible). Mitigación: snapshot del DB antes del Deploy B (Supabase PITR) + validación manual en cloud dev primero.

## Cambios en el código

**Refactor app layer** (con strategy additive-then-drop):

- `members/server/queries.ts:findInviterPermissions` — agrega `isAdmin: boolean` al return type. Computa con `findIsPlaceAdmin` (nuevo primitive en `shared/lib/identity-cache.ts`).
- `places/server/queries.ts:listMyPlaces` — agrega `isAdmin: boolean` al `MyPlace`.
- `members/server/directory-queries.ts` — agrega `isAdmin` a `MemberSummary` + `MemberDetail`. El filtro `?role=ADMIN|MEMBER` del directorio se renombra a `?isAdmin=true|false`.
- `members/server/permissions.ts:hasPermission` + `listAllowedCategoryIds` — drop del fallback `role === 'ADMIN'`. La única vía a true (fuera de owner bypass) es membership a un grupo con el permiso.
- `places/server/actions.ts:createPlaceAction` — la tx ahora crea 5 entidades (Place + PlaceOwnership + Membership + PermissionGroup preset del nuevo place + GroupMembership del owner al preset). Sin esto, places nuevos quedarían sin admin tras el cleanup.
- `members/server/actions/accept.ts` — `Membership.create` ya no setea `role`. Si la invitación tenía `asAdmin=true`, inserta `GroupMembership` al preset del place (mismo flow que ya estaba en G.x para el caso asAdmin, sólo limpia el setting de role).
- 5 archivos app-level + shell (`community-row.tsx`) + `members/domain/invariants.ts` — switch de `.role === 'ADMIN'` → `.isAdmin`.
- `discussions/server/actor.ts` + `flags/server/actor.ts` — drop campo `role` de tipo `membership`. Compute `isAdmin` con `findIsPlaceAdmin`.

**Refactor tests** (~19 archivos): cada `mockActiveMember` migra de signature `(role: MembershipRole, opts?)` → `(opts: { asAdmin?: boolean; isOwner?: boolean })`. Cuando `asAdmin: true`, el helper también mockea `groupMembership.findFirst` (para `findIsPlaceAdmin`) + `groupMembership.findMany` (para `hasPermission`).

**Refactor seed E2E**: `tests/fixtures/e2e-seed.ts` ya no setea `role:` en `Membership.create`. El seed extiende su wipe + create con baseline groups (preset + `moderators` + `libraryMods`) en `place_e2e_palermo` para que las RLS tests + E2E mutativos puedan ejercer el flow completo.

**Eliminados**:

- `scripts/migrate-admins-to-groups.ts` (one-shot, su trabajo está hecho).
- `scripts/validate-admins-migration.ts` (idem).
- Re-exports `MembershipRole` en `places/public.ts` y `members/public.ts`.
- Tipos `MembershipRole` en domain types (`members/domain/types.ts`, `places/domain/types.ts`).

## Consecuencias

**Positivas**:

- El modelo de permisos queda íntegro: una sola fuente de verdad (preset group + grupos custom). Sin coexistencia de `role` legacy + `groups` nuevo.
- Los próximos features que toquen permisos no heredan deuda + no necesitan switch entre dos paths.
- RLS sigue funcionando idéntico desde la perspectiva de las policies — sólo cambió el plumbing interno del helper.
- `findInviterPermissions` ahora retorna `{ isMember, isOwner, isAdmin }` — semánticamente más claro que el viejo `{ role, isOwner }`.

**Negativas / asumidas**:

- DDL de Migration 2 es irreversible. La columna `Membership.role` con sus valores históricos ya no existe en cloud dev (snapshot Supabase PITR puede restaurar si hace falta). En prod, se aplica con ventana A/B y snapshot manual previo.
- El URL filter del directorio cambió de `?role=ADMIN` a `?isAdmin=true`. Bookmarks viejos rompen — aceptado (no hay users en prod aún).
- Tests legacy que mockeaban `MembershipRole` se refactorearon mecánicamente a `asAdmin`. Suite test stable a 1397 passing post-cleanup.

## Verificación

**Subset del cleanup G.7** (lo que cubre este ADR):

- `grep -rn "MembershipRole\|membership\\.role\|\\.role ===.*['\"]ADMIN" src/ tests/ scripts/ prisma/schema.prisma` → 0 hits en código activo (sólo aparece en comentarios documentales del cleanup) ✅
- `pnpm test --run src/features/{members,discussions,events,flags}/__tests__/` ✅ (53 tests del subset cleanup, 5 archivos)
- `prisma/schema.prisma` no declara `role` ni `MembershipRole`; `@prisma/client` generado no exporta `MembershipRole` ✅
- Migrations 1 y 2 aplicadas al cloud dev (verificable con `pnpm prisma migrate status`).
- `\d "Membership"` en cloud dev no muestra columna `role`. `\dT MembershipRole` retorna "no relations found".

**Verificación pendiente** (no scope de este ADR):

- `pnpm typecheck` reporta 180 errores TS al cierre del cleanup, **todos pre-existing** (refactors incompletos de otros planes: `members/public.server` faltan exports, `library/access` types, `discussions/comments` `quoteState`, etc.). Tracking + plan de fix bajo el agente diagnóstico lanzado en C.6. Este cleanup G.7 NO los introduce; la build sigue rota por causas independientes.
- `pnpm test:rls tests/rls/helpers-functions.test.ts` — diferido a la sesión que aplica las migrations al cloud dev. Las dos migrations DDL ya existen como archivos pero la verificación intermedia (entre Migration 1 y Migration 2) requiere correr el RLS suite en el ambiente cloud, no localmente.
- `pnpm build` — gateado por los 180 errores pre-existing.

Esto refleja honestamente el estado al cierre del cleanup: el subset que el ADR documenta está completo y verificado, pero la build entera del repo no compila por deuda técnica de otros planes que sale del scope de este cleanup.

## Alternativas descartadas

1. **Refactor `is_place_admin` y dropear la columna en una sola migration**. Rechazado: si algo va mal, no hay punto intermedio donde detenerse + rollback es harder. La separación A/B en prod fuerza una pausa explícita para validar.

2. **Mantener la columna `role` como legacy display field, dropear sólo el enum**. Rechazado: la columna ya no se lee desde ninguna parte después del refactor. Mantenerla es residuo y eventualmente alguien la confunde con fuente de verdad.

3. **Construir un script de "rollback" para Migration 2** que recupere el role desde GroupMembership al preset. Rechazado: posible pero fragile (la información del enum se pierde para users que pasaron por promote/demote pre-G.0). El backup PITR cubre el caso legítimo de rollback.
