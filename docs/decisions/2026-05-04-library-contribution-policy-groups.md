# Library: drop `ADMIN_ONLY`, agregar `SELECTED_GROUPS` con scope a permission groups

**Fecha:** 2026-05-04
**Slice:** `library`
**Status:** Decidido. Implementación dividida en F.0–F.4 (ver `docs/plans/` o esta misma sesión).
**Autor:** Max

## Contexto

El enum `ContributionPolicy` de `LibraryCategory` define quién puede crear items en la categoría. Hasta hoy (3 valores):

- `ADMIN_ONLY` — sólo admins/owner.
- `DESIGNATED` — admins/owner + miembros listados en `LibraryCategoryContributor`.
- `MEMBERS_OPEN` — cualquier miembro activo.

Con el cleanup C.3 (`docs/decisions/2026-05-03-drop-membership-role-rls-impact.md`) el "rol Admin" como concepto separado dejó de existir: admin se modela exclusivamente como **membership al permission group preset "Administradores"**. La categoría con `ADMIN_ONLY` quedó conceptualmente equivalente a "asignar el preset al scope de la categoría".

Al mismo tiempo, la tabla `GroupCategoryScope` ya existe en el schema (migration `20260502030000_permission_groups_schema`) como join `PermissionGroup ↔ LibraryCategory` — modelada como future-proofing precisamente para este caso.

## Decisión

1. **Drop `ADMIN_ONLY`** del enum `ContributionPolicy`.
2. **Agregar `SELECTED_GROUPS`**: la categoría puede ser contribuida por miembros que estén en al menos uno de los `PermissionGroup` asignados (incluye el preset "Administradores" como grupo elegible más).
3. **Cambiar el default** de la columna `LibraryCategory.contributionPolicy` de `ADMIN_ONLY` a `MEMBERS_OPEN` — alineado con el principio "calmo y abierto" del producto y porque el viejo default ya no existe.
4. **`canCreateInCategory`**: branch owner-bypass primero (`if (viewer.isOwner) return true`). Después evalúa policy. SELECTED_GROUPS evalúa como `viewer.groupIds.some((g) => category.groupScopeIds.includes(g))`.
5. **Reusar tabla `GroupCategoryScope`**: misma tabla que future-proofing del schema; semánticamente es "este grupo tiene scope a esta categoría" sin importar la dirección de uso.
6. **NO reusar `setGroupCategoryScopeAction`** del slice `groups`: ese action es group-centric y bloquea el preset (`cannot_scope_preset`). Library necesita un action category-centric que **permita** el preset. Crear `setLibraryCategoryGroupScopeAction` propio en `library/server/actions/`.
7. **Migración del enum en 2 pasos** (mismo patrón que cleanup C.3 para `Membership.role`):
   - **M1 (additive)**: `ALTER TYPE "ContributionPolicy" ADD VALUE 'SELECTED_GROUPS'`. Backwards-compat. App sigue leyendo y escribiendo ADMIN_ONLY hasta que F.4 lo dropea.
   - **M2 (drop)**: recrear el enum sin `ADMIN_ONLY` (Postgres no soporta `DROP VALUE` directo). Patrón: `CREATE TYPE _new + ALTER COLUMN USING + DROP TYPE + RENAME`. Sólo corre cuando F.3 está deployado y verificado que ninguna fila usa el valor.
8. **Datos existentes**: el usuario confirmó (sesión 2026-05-04) que no hay datos productivos con `ADMIN_ONLY` que migrar. La única fila E2E (`adminOnly` en seed `tests/fixtures/e2e-data.ts`) se actualiza in-place a `MEMBERS_OPEN`. Sin script de data migration.
9. **RLS**: las RLS policies para SELECTED_GROUPS (control SQL-level del INSERT en `LibraryItem` cuando la categoría tiene grupos asignados) **quedan diferidas** a la fase de RLS general posterior. La validación vive sólo en app layer (`canCreateInCategory` en server actions) hasta entonces. Decisión del usuario en sesión 2026-05-04: "no hay RLS todavia en supabase, y explicitamente no las añadimos de momento hasta acabar todas las funcionalidades". El ADR registra explícitamente el deferral para que la fase de RLS sepa que esta política está pendiente.

## Razones

1. **Eliminar deuda conceptual**: `ADMIN_ONLY` referencia un rol que ya no existe. Mantenerlo obliga a documentar "ADMIN_ONLY = preset 'Administradores'", agregando indirección.
2. **Modelo unificado de permisos**: post-C.3, la fuente canónica de "quién puede X" son los permission groups. `SELECTED_GROUPS` cierra el círculo para library — el owner usa el mismo concepto (asignar grupos) tanto para delegar moderación como para controlar contribución a categorías.
3. **Reusar infraestructura existente**: `GroupCategoryScope` ya estaba modelada para esto. Crear nada nuevo a nivel schema.
4. **Owner-bypass first**: principio de simplicidad. El owner siempre puede contribuir sin importar policy. La policy sólo aplica a no-owners. Match con el patrón establecido del slice (`canEditCategory: viewer.isAdmin → true`).
5. **Drop en 2 pasos**: production-grade. M1 deploya antes que M2 → window donde rollback no requiere data restore. Mismo patrón que C.3 (`drop-membership-role-rls-impact.md`).

## Riesgos

| Riesgo                                                                                                               | Mitigación                                                                                                                                                                                                                                                     |
| -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App tiene `case 'ADMIN_ONLY'` quemado en lugares no detectados                                                       | F.4 termina con grep final `'ADMIN_ONLY'` en `src/`, `tests/`, `prisma/migrations/`. 0 hits excepto SQL del drop.                                                                                                                                              |
| M2 falla porque alguna fila quedó en ADMIN_ONLY                                                                      | M2 incluye query previa `SELECT count(*) FROM "LibraryCategory" WHERE "contributionPolicy" = 'ADMIN_ONLY'`. Si > 0, la migration aborta. F.3 actualiza el seed E2E + manualmente cualquier fila dev.                                                           |
| `LibraryViewer.groupIds` no populado en algún caller → falsos negativos                                              | F.1 actualiza `resolveActorForPlace` (o equivalente) y todos los callers verifican via tests. La populación de `groupIds` reusará la query existente de `groupMembership.findMany` que ya hace `hasPermission` (cacheable con `React.cache` en mismo request). |
| Action propio en library duplica lógica con `setGroupCategoryScopeAction` de groups                                  | Aceptado: divergen en validación (preset). La duplicación es sólo del flow tx + auth (~30 LOC). Si en el futuro converge la lógica, se factoriza un helper.                                                                                                    |
| RLS deferida → un atacante con sesión válida pero sin GroupMembership al grupo asignado logra INSERT vía SQL directo | Aceptado: el patrón establecido del proyecto es validación app-first y RLS como defensa en profundidad. La RLS para library entera está pendiente; SELECTED_GROUPS no es excepción. Cuando la fase de RLS llegue, este ADR queda como precondición conocida.   |

## Cuándo revisar

Revisar este ADR si:

- Aparece un caso donde la dirección "category-centric" del action library converja con la "group-centric" del action groups en una misma operación. Ahí evaluar factorizar.
- Se decide implementar RLS antes que el resto de funcionalidades. Aquí entra el SQL helper `can_create_in_category(category_id, user_id)` con JOIN a `GroupCategoryScope` + `GroupMembership`.
- El cap del slice library (post-`2026-05-01-library-action-tests-size-exception.md`) excede 1500 LOC prod. El cambio actual estima +150-200 LOC; si futuras extensiones lo elevan, requiere ADR de slice-level exception análoga a discussions.

## Referencias

- `docs/decisions/2026-05-03-drop-membership-role-rls-impact.md` — cleanup C.3 que motiva drop de ADMIN_ONLY.
- `docs/decisions/2026-05-02-permission-groups-model.md` — modelo de permission groups + scope.
- `docs/decisions/2026-05-01-library-action-tests-size-exception.md` — cap de tests del slice library (no aplica a este cambio que toca prod).
- `docs/features/library/spec.md` — actualizar § Vocabulario + § Permisos en F.4.
- `prisma/schema.prisma:846-852` — `GroupCategoryScope` ya existente.
- `src/features/groups/server/actions/set-group-category-scope.ts` — action group-centric (no reusable, bloquea preset).
