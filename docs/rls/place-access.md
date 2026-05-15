# RLS — Feature: acceso al place

> El comportamiento de abajo fue **definido en conversación con el
> owner** (2026-05-15), NO extraído de specs. `docs/features/places/spec.md`
> está **desactualizado** respecto a esto (no contempla directorio,
> preview público ni solicitudes de unión) — deuda de doc de producto
> registrada al final.

Tablas de esta feature: `Place`, `Membership`, `PlaceOwnership`.

## Comportamiento esperado (acordado)

### Crear

- Cualquier **usuario registrado** (desde la landing `place.community`)
  puede crear un place. Al registrarse elige: crear place / unirse vía
  directorio / aceptar invitación recibida.
- Crear = transacción server-side: `Place` + `PlaceOwnership(creator)` +
  `Membership(creator, activa)`. El `userId` sale de la sesión, nunca
  del input.

### Ver

- **Miembro activo** del place → ve el place completo y su contenido.
- **No-miembro** (cualquier usuario registrado) → ve un **preview
  público** SOLO de places que el owner marcó como **visibles/
  discoverable**. El preview es **solo `slug` + `name` +
  `description`**. Nada más: ni contenido, ni cantidad de miembros, ni
  actividad (coherente con "sin métricas vanidosas").
- Place **no** marcado discoverable → **invisible** para no-miembros
  (default: íntimo, coherente con CLAUDE.md).
- El **contenido** del place (posts, eventos, biblioteca, etc.) nunca es
  público — su privacidad la enforce la RLS de _sus_ tablas
  (`is_active_member`), no la de `Place`.

### Administrar / archivar

- **Owner(s)**: siempre pueden configurar todo y archivar. Config del
  place y archivar son **owner-only** (no delegable — consistente con
  ADR `2026-05-02`: settings del place no son permiso atómico).
- Los **permisos granulares** (grupos creados en `settings/groups`,
  solo el owner crea grupos) aplican a **moderación de contenido**
  (discussions/library/events/flags), **no** a la config del `Place` en
  sí. Por eso no entran en la RLS de estas 3 tablas.

### Unirse

- Por **invitación** (flujo server-side; la RLS de `Invitation` se
  define en la feature membresía/invitación).
- **Solicitudes de unión** (aplicar a un place discoverable): **feature
  aparte, pendiente** — ver "Pendientes".

## Roles

| Rol                           | Definición                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------- |
| owner                         | fila en `PlaceOwnership(userId, placeId)`. Helper `is_place_owner`.                   |
| miembro activo                | `Membership(userId, placeId)` con `leftAt IS NULL`. Helper `is_active_member`.        |
| usuario registrado no-miembro | sesión válida, sin `Membership` en ese place. Solo ve preview de places discoverable. |
| ex-miembro                    | `Membership.leftAt IS NOT NULL`. Sin acceso.                                          |
| service-role                  | app server-side. Gestiona crear/join/leave/transfer (bypassa RLS hasta el switch).    |

## Dependencia de implementación

La RLS de `Place` SELECT necesita un campo nuevo **`Place.discoverable
boolean default false`** (NO existe hoy en el schema). Mientras no se
implemente (campo + toggle en `/settings`), todos los places son
no-discoverable → el preview público no opera, pero la policy ya queda
correcta para cuando exista. Registrado como dependencia, no bloquea la
RLS de las otras 2 tablas.

## RLS derivada

Helpers `SECURITY DEFINER` (D1 del README): `is_active_member(placeId)`,
`is_place_owner(placeId)`. Migran de INVOKER→DEFINER en la misma
migración que habilita RLS aquí.

> **Hallazgo 2026-05-15 (agente de verificación) — `is_active_member`
> debe excluir bloqueados.** Hoy `is_active_member` = `Membership`
> con `leftAt IS NULL`. Pero existe `Membership.blockedAt` (la action
> `blockMemberAction` lo setea) que **hoy no tiene ningún efecto**: el
> gate de enforcement (`findViewerBlockState`/`UserBlockedView`) no
> existe — solo se menciona en comentarios. Un miembro bloqueado sigue
> entrando. **Decisión derivada**: al construir la RLS,
> `is_active_member` debe ser `leftAt IS NULL AND blockedAt IS NULL`
> (un bloqueado NO es miembro activo a efectos de acceso). Eso hace que
> el block surta efecto vía RLS. El gate app-layer equivalente
> (layout) es trabajo separado (no-RLS) — registrado como pendiente.

### `Place`

| Op     | Quién                                   | Policy                                                      |
| ------ | --------------------------------------- | ----------------------------------------------------------- |
| SELECT | miembro activo **o** place discoverable | `is_active_member(id) OR "discoverable" = true`.            |
| UPDATE | owner                                   | `is_place_owner(id)`. (Config + `archivedAt` = owner-only.) |
| INSERT | — (deny)                                | service-role: `createPlaceAction`.                          |
| DELETE | — (deny)                                | No hay hard-delete (solo `archivedAt` vía UPDATE owner).    |

**Riesgo column-level (decisión)**: RLS es por _fila_, no por columna.
Si `discoverable=true`, un usuario registrado podría
`SELECT * FROM "Place"` y leer campos sensibles
(`stripeCustomerId/SubscriptionId/ConnectId`). El "preview = solo
slug+name+description" **no** se garantiza con RLS de fila. **Decisión**:
crear una **vista `PlaceDirectory` (slug, name, description) con
`security_invoker`** que el directorio consume; `Place` SELECT directo
se restringe a `is_active_member` y los campos sensibles nunca salen por
la vista. Esto se diseña en Fase 2 (es la forma correcta de "preview
mínimo"). Alternativa descartada: app-layer recorta columnas — frágil,
un caller que olvide el `select` filtra secretos.

### `Membership`

| Op                   | Quién                            | Policy                                                      |
| -------------------- | -------------------------------- | ----------------------------------------------------------- |
| SELECT               | self **o** admin/owner del place | `userId = auth.uid()::text OR is_place_admin("placeId")`.   |
| INSERT/UPDATE/DELETE | — (deny)                         | service-role: join (aceptar invitación), `leftAt`, erasure. |

### `PlaceOwnership`

| Op                   | Quién                    | Policy                                                                                              |
| -------------------- | ------------------------ | --------------------------------------------------------------------------------------------------- |
| SELECT               | miembro activo del place | `is_active_member("placeId")` (quién es owner es público intra-place).                              |
| INSERT/UPDATE/DELETE | — (deny)                 | service-role: crear place, transferir ownership (invariante "mín 1 owner" se enforce en la action). |

## Composición / riesgos al activar (Fase 3)

- `is_active_member`/`is_place_owner`/`is_place_admin` pasan a `SECURITY
DEFINER` en la misma migración que habilita RLS en estas tablas
  (sin eso se rompen — lección de `20260515000100`).
- Toda escritura de las 3 tablas es server-side. Verificar en Fase 3 que
  ningún code-path las escriba con cliente RLS-aware.
- La vista `PlaceDirectory` debe excluir places archivados además de
  filtrar `discoverable`.

## Pendientes (feature aparte, registrados)

1. **`Place.discoverable`** — campo + toggle en `/settings`. Dependencia
   de la policy `Place` SELECT.
2. **Vista `PlaceDirectory`** — preview público column-safe (Fase 2).
3. **Solicitudes de unión (`JoinRequest`)** — modelo + RLS cuando se
   implemente la feature; un owner o miembro de grupo con permiso acepta
   la solicitud. No diseñado acá por decisión del owner.
4. **Deuda de doc de producto**: `docs/features/places/spec.md`
   desactualizado (dice "sin directorio público / place invisible") vs
   el comportamiento acordado (directorio + preview + join requests).
   Actualizar ese spec es trabajo aparte.
