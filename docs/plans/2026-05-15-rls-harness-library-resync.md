# Plan — Resincronizar harness RLS de library con write/read-scope

**Fecha**: 2026-05-15
**Estado**: propuesto (Fase 0 ejecutada — plan fijado sin gaps)
**Origen**: follow-up #2 del ADR `2026-05-15-rls-incremental-write-holistic-activate.md`.
Desbloquea la verificación del test RLS de read-scope (Plan A S4).

## Contexto

No es un error: deuda de migración. `20260513000000` reemplazó el
modelo viejo (`ContributionPolicy` + tabla `LibraryCategoryContributor`)
por `writeAccessKind`/`readAccessKind` + 6 tablas scope. El runtime ya
fue migrado; la **infra de tests RLS de library** no.

## Fase 0 — Diagnóstico (EJECUTADA, evidencia)

| Pregunta                                      | Hallazgo                                                                                                                                                                                                     | Fuente                                              |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| ¿BD de `test:rls` rota hoy o al aplicar S4?   | `20260513000000` aplicada 2026-05-13; `20260515000000` (S4) NO aplicada. **El harness está roto desde el 13-may** (inserta en `contributionPolicy` dropeada). `test:rls` falla en library-\* desde entonces. | `_prisma_migrations` (MCP)                          |
| Alcance `library-category.test.ts` (17 casos) | Casos **1-11** (LibraryCategory base): policies sin cambio (RLS on, 3 policies) → solo helper reparado, **misma lógica**. Casos **12-17** (`LibraryCategoryContributor`): tabla eliminada.                   | lectura completa del test                           |
| ¿Hay cobertura RLS equivalente para 12-17?    | **NO**: las 6 tablas `LibraryCategory*{Read,Write}Scope` tienen `rls_on=false, 0 policies`. Sin equivalente → los 6 casos se **eliminan**, no se reescriben.                                                 | `pg_class`/`pg_policy` (MCP)                        |
| ¿e2e-data.ts / e2e-seed.ts necesitan cambio?  | **NO**. Ambos ya migrados (`readAccessKind`/`writeAccessKind`/`libraryCategoryUserWriteScope.create`). El "S3" del borrador previo **sobraba** (era un grep sobre un comentario).                            | lectura `e2e-data.ts:202-232`, `e2e-seed.ts:94-327` |
| Alcance `library-item.test.ts`                | Casos SELECT (1-3): solo helper. Casos INSERT 4-10: prueban la policy vieja `LibraryItem_insert_with_policy` (dropeada) con `contributionPolicy` → reescribir a `writeAccessKind`.                           | lectura del test                                    |

**Hallazgo nuevo (follow-up, fuera de scope de este plan)**: las 6
tablas `LibraryCategory*{Read,Write}Scope` **no tienen RLS** — un
`authenticated` puede `SELECT` directo quién tiene acceso a qué.
Superficie de metadata sin proteger. Va al comprehensive RLS pre-launch
(ADR `2026-05-01` / `2026-05-15-rls-incremental...`). Se registra; no se
arregla acá (este plan es solo infra de test).

## Decisiones (fijadas con evidencia)

| #   | Decisión                                                                                                                                                                                                                                             | Razón                                                                                                      |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| A   | `insertTestLibraryCategory`: quitar `contributionPolicy` + `ContributionPolicyValue`; sumar `readAccessKind?`/`writeAccessKind?` (default PUBLIC/OWNER_ONLY = defaults del schema)                                                                   | Defaults seguros → casos 1-3/1-11 que pasan solo `{placeId}` siguen funcionando sin cambios                |
| B   | Eliminar `insertTestLibraryContributor`. Sumar `insertTestLibraryWriteScope` + `insertTestLibraryReadScope` (group/tier/user)                                                                                                                        | Tabla muerta; el equivalente nuevo es sembrar filas de scope para los tests INSERT/SELECT del modelo nuevo |
| C   | `library-category.test.ts` casos 12-17: **eliminar** (no reescribir). Actualizar `describe` (quitar "+ LibraryCategoryContributor"). Comentario in-test explicando: tabla dropeada + tablas scope sin RLS → cobertura N/A, registrada como follow-up | No hay superficie RLS equivalente (verificado). Reescribir sería inventar cobertura inexistente            |
| D   | `library-item.test.ts` casos 4-10: reescribir `contributionPolicy=ADMIN_ONLY/MEMBERS_OPEN/DESIGNATED` → `writeAccessKind=OWNER_ONLY/USERS/GROUPS/TIERS` + scope rows. Paridad funcional con `LibraryItem_insert_with_write_access`                   | El test debe cubrir la policy INSERT vigente, no la dropeada                                               |
| E   | Sumar bloque SELECT read-scope a `library-item.test.ts` que valida la policy de la migración `20260515000000` (S4): PUBLIC, owner, GROUPS/TIERS/USERS match/no-match, write-implica-read, admin audit, author blind-write                            | Esta es la verificación que S4 no pudo hacer; cierra Plan A S4                                             |
| F   | NO tocar `e2e-data.ts`/`e2e-seed.ts` (ya migrados — verificado)                                                                                                                                                                                      | El borrador previo erró por grep sobre comentario; descartado con evidencia                                |

## Sesiones

### S1 — Reparar helpers `harness.ts` (local, riesgo cero)

- `insertTestLibraryCategory`: decisión A.
- Eliminar `insertTestLibraryContributor` + `ContributionPolicyValue`.
- NEW `insertTestLibraryWriteScope` / `insertTestLibraryReadScope`.
- Verif: `pnpm typecheck`. Los tests aún usan API vieja → rojo esperado hasta S2 (no se corre test:rls acá).

### S2 — Reescribir los 2 tests RLS de library (local)

- `library-category.test.ts`: casos 1-11 intactos (helper reparado). Eliminar 12-17 + actualizar `describe` + comentario de cobertura N/A (decisión C).
- `library-item.test.ts`: SELECT con helper; INSERT 4-10 → writeAccessKind + scope (decisión D); nuevo bloque SELECT read-scope (decisión E).
- Verif: `pnpm typecheck` + revisión estática (la corrida real es S3 — cloud).

### S3 — ✅ EJECUTADA (migración + test escritos, no aplicada)

NEW `20260515000100_library_scope_tables_rls` (6 `ALTER TABLE ENABLE
RLS` + 6 SELECT policies admin/owner, sin INSERT/UPDATE/DELETE =
deny-by-default). NEW `tests/rls/library-scope-tables.test.ts` (6 casos:
admin/owner ve, member/nonMember no, escritura deny). typecheck verde,
SQL balanceado. NO aplicada a cloud (= S4, gate OK explícito).

### S3 — Plan original (referencia)

Cierra la inconsistencia detectada en Fase 0 (decisión del owner:
dejarlas listas ahora, no diferir al comprehensive). Coherente con la
estrategia "incremental-escrito, activación holística" del ADR
`2026-05-15-rls-incremental...`: policies escritas+testeadas ahora, sin
activar runtime.

- NEW migración `20260515000100_library_scope_tables_rls`:
  - `ENABLE ROW LEVEL SECURITY` en las 6 tablas
    `LibraryCategory{Group,Tier,User}{Read,Write}Scope`.
  - **SELECT policy** (decisión G): solo admin/owner del place de la
    categoría — `EXISTS (SELECT 1 FROM "LibraryCategory" c WHERE
c."id" = "categoryId" AND (public.is_place_admin(c."placeId") OR
public.is_place_owner(c."placeId")))`. Razón: es metadata de
    configuración administrativa; ningún flujo de usuario normal la lee
    directo (la app usa service-role). Menor exposición.
  - **Sin policy INSERT/UPDATE/DELETE** → deny-by-default para
    `authenticated`. La app las gestiona vía service-role
    (`setLibraryCategoryReadScopeAction`/`...WriteScopeAction`). Mismo
    patrón que `ErasureAuditLog` (ADR 2026-05-01: "INSERT/UPDATE solo
    via service-role").
- Tests RLS en harness (S2 ya repara los helpers): admin/owner ve,
  member NO, non-member NO, escritura bloqueada para authenticated.
  Reemplaza conceptualmente la cobertura de los ex-casos 12-17 (que
  protegían el `LibraryCategoryContributor` muerto) con la superficie
  vigente.
- Verif: `pnpm typecheck` + revisión estática. Corrida real en S4.

### S4 — Aplicar migraciones a cloud + `pnpm test:rls` (CLOUD — gate OK explícito)

- Aplicar `20260515000000_library_read_scope_rls` (Plan A S4) +
  `20260515000100_library_scope_tables_rls` a la BD del proyecto
  (`prisma migrate deploy` / Supabase MCP).
- `pnpm test:e2e:seed` (fixture ya correcto) + `pnpm test:rls` → verde,
  incluidos los bloques read-scope + scope-tables.
- **Comprueba** lo que era inferido (policies S4 read-scope + scope
  tables + harness reparado). Único paso con blast radius (cloud) —
  requiere confirmación explícita, como un deploy.

### Decisión G (fijada)

SELECT de las 6 tablas scope = solo admin/owner del place (no
member-transparent como lo era el `LibraryCategoryContributor` viejo).
Razón: principio de menor exposición — la metadata de "qué grupo/tier/
user mapea a qué categoría" es config administrativa; ningún code-path
de usuario la consume directo (la app resuelve acceso server-side vía
service-role). Si emergiera un caso que requiera member-read, se amplía
con evidencia. Documentado para el comprehensive pre-launch.

## Regla de oro

Otros tests RLS (post/comment/event/flag/...) NO usan helpers de library
→ no se tocan (blast radius acotado, verificado por grep). Cero cambio
de runtime (solo infra de test). Commits aislados por sesión. S3 gateado.

## Follow-ups registrados (no se pierden)

1. Tablas `LibraryCategory*{Read,Write}Scope` sin RLS → comprehensive
   pre-launch (cobertura que daban los ex-casos 12-17, ahora N/A).
2. Aplicar S4 a cloud (S3 de este plan) cierra Plan A S4 (verificación
   inferido→comprobado).

**LOC estimado**: S1 ~90, S2 ~220 (neto: -120 de casos eliminados +
~340 reescritos/nuevos), S3 0 (ejecución). Sin S3-fixture (descartado).
