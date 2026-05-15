# RLS — Feature: permisos / grupos

> Comportamiento **definido en conversación con el owner** (2026-05-15).
> Tablas: `PermissionGroup`, `GroupMembership`.

## Comportamiento esperado (acordado)

La **gobernanza de permisos de un place es privada del owner**:

- **Ver** los grupos del place y su composición (qué permisos tiene
  cada grupo, qué usuarios pertenecen): **solo el/los owner(s)**. Ni un
  miembro de un grupo ve la config de permisos — la estructura de
  gobernanza no es transparente intra-place.
- **Crear / editar / borrar** grupos y **asignar permisos** a un grupo:
  **solo owner, no delegable**. El grupo preset "Administradores" no se
  puede borrar ni modificar sus permisos.
- **Asignar / quitar usuarios** a un grupo (membresía del grupo):
  **solo owner, no delegable**.

Todo lo relativo a grupos/permisos es owner-only en las 4 operaciones.
Consistente con ADR `2026-05-02-permission-groups-model` (CRUD de grupos
= owner-only) y lo que el owner ya había dicho ("los grupos solo los
puede crear un owner").

## Roles

| Rol                        | En esta feature                                                                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| owner                      | único que ve / crea / edita / borra grupos y asigna permisos y usuarios.                                                             |
| miembro (en un grupo o no) | **no** ve la config de permisos. Lo que un permiso le habilita lo vive como capacidad (puede o no hacer X), no viéndose en la tabla. |
| service-role               | la app server-side ejecuta el CRUD que dispara el owner.                                                                             |

## RLS derivada

Helper `is_place_owner(placeId)` — `SECURITY DEFINER` (D1 del README).

### `PermissionGroup`

| Op                       | Quién           | Policy                                                                                                                                                                                                          |
| ------------------------ | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SELECT                   | owner del place | `is_place_owner("placeId")`.                                                                                                                                                                                    |
| INSERT / UPDATE / DELETE | — (deny)        | service-role: el CRUD lo gestiona la app server-side (gateada owner-only en la action). El cliente nunca toca la tabla directo. La protección del preset (no borrar "Administradores") se enforce en la action. |

### `GroupMembership`

| Op                       | Quién           | Policy                                                                                                       |
| ------------------------ | --------------- | ------------------------------------------------------------------------------------------------------------ |
| SELECT                   | owner del place | `is_place_owner("placeId")` (la columna `placeId` está denormalizada en `GroupMembership` — usarla directo). |
| INSERT / UPDATE / DELETE | — (deny)        | service-role: asignar/quitar usuarios a grupos lo hace la app (gateada owner-only).                          |

## Composición / riesgo CRÍTICO al activar (Fase 3)

**Este es el punto que repitió el error de S3 si no se contempla.** Dos
consumidores leen estas tablas para resolver acceso de **todos** los
usuarios (no solo owners):

1. **`is_place_admin(placeId)`** (helper SQL): `admin` = miembro del
   grupo preset "Administradores" ∪ owner → lee `GroupMembership` +
   `PermissionGroup`. Si fuera `SECURITY INVOKER` y estas tablas tienen
   RLS owner-only, un member común evaluando una policy que usa
   `is_place_admin` obtendría `false` siempre → moderación rota.
   **Mitigado por D1**: `is_place_admin` es `SECURITY DEFINER` → lee
   estas tablas bypaseando su RLS. **Obligatorio** que la migración que
   habilita RLS aquí también convierta `is_place_admin` a DEFINER en el
   mismo cambio.

2. **`hasPermission(userId, placeId, perm)`** (app-layer TS,
   `src/features/members/server/permissions.ts`): hace
   `prisma.groupMembership.findMany` para evaluar permisos delegados de
   **cualquier** usuario. Hoy corre con service-role (bypassa RLS) →
   OK. **Al activar el switch (Fase 3)**, si Prisma corre como
   `authenticated`, este `findMany` lo bloquearía la RLS owner-only →
   `hasPermission` devolvería `false` para todo no-owner → **todos los
   permisos delegados se romperían en runtime**.

   **Decisión para Fase 3 (registrada, no se resuelve acá)**: la
   resolución de permisos/membership debe correr por un path que
   bypassa RLS — opciones: (a) `hasPermission` vía una función SQL
   `SECURITY DEFINER` invocada desde la app; (b) el wrapper del switch
   excluye las queries de resolución de identidad/permisos del claim
   `authenticated` (las corre con service-role). Esto se diseña en el
   doc del switch (Fase 3) ANTES de activar — es el riesgo central.

## Estado de features relacionadas (de agentes de verificación)

- **Transfer ownership**: ✅ IMPLEMENTADO Y CABLEADO completo
  (`places/server/actions.ts:191` `transferOwnershipAction`): gate
  owner-only, receptor debe ser miembro activo, invariante mín-1-owner
  enforced en tx con `SELECT ... FOR UPDATE`, UI en
  `/settings/danger-zone`, 13 tests. **Pendiente #3 de
  membership-invitation: RESUELTO** (ya estaba bien implementado).
  Nota del agente: `PlaceOwnership` no tiene policy RLS en migraciones
  → es parte del trabajo RLS comprehensive (este), no un gap nuevo.

## Pendientes

Ninguno propio de esta feature. La RLS es trivial (owner-only); el
trabajo real está en la **composición** (sección de arriba) que se
ejecuta en Fase 2 (DEFINER en `is_place_admin`) + Fase 3 (path de
`hasPermission`).
