# RLS — Feature: membresía / invitación

> Comportamiento **definido en conversación con el owner** (2026-05-15).
> Tabla de esta feature: `Invitation`. El lifecycle de `Membership`
> (alta al aceptar, `leftAt` al salir/expulsar) ya quedó documentado en
> `place-access.md`; acá se referencia.

## Comportamiento esperado (acordado)

### Quién puede invitar — CONFIGURABLE por place

El owner define, desde un **área de configuración general del place en
`/settings` (a crear — pendiente)**, la política de invitación:

- Quién puede invitar: **solo el owner** / **N grupos** / **N tiers** /
  **N users** / **cualquier miembro**.
- **Cuotas**: número máximo de invitaciones disponibles por grupo, por
  tier, por users o para todos los miembros.

Esto es un **modelo de configuración nuevo** (invite-policy + quotas)
que NO existe en el schema. La evaluación de "¿este actor puede invitar
y le queda cuota?" es **lógica server-side (app-layer)** previa a crear
la `Invitation`. La RLS no la expresa (ver más abajo).

### Cómo se acepta una invitación — AMBAS vías

1. **Link con token único** (email): la invitación lleva un `token`; el
   invitado abre el link, y con sesión válida la acción server-side
   resuelve la invitación por `token` y crea su `Membership`.
2. **En-app por match de email**: el invitado entra a `place.community`
   y ve las invitaciones pendientes dirigidas a **su email**; acepta
   desde ahí (sin token en la URL).

Ambas coexisten. La creación de `Membership` al aceptar es server-side.

### Quién puede expulsar / remover un miembro

- **Owner** siempre; **delegable** a grupos vía el permiso
  `members:block` (ya existe en el catálogo de permisos). No se puede
  expulsar a un owner.
- Mecánicamente: setear `Membership.leftAt` (o estado bloqueado) —
  server-side.

### Transferir ownership

- Solo un **owner** puede transferir. El **receptor debe ser miembro
  activo**. Nunca quedan **0 owners** (invariante CLAUDE.md). El owner
  saliente puede quedar como miembro o salir — su elección.
- Mecánicamente: server-side (mueve/crea fila en `PlaceOwnership` con la
  invariante "mín 1 owner" enforced en la action).

## Roles

| Rol                                | En esta feature                                                                             |
| ---------------------------------- | ------------------------------------------------------------------------------------------- |
| owner                              | invita siempre; expulsa siempre; único que transfiere ownership; ve invitaciones del place. |
| grupo/tier/users con invite-policy | pueden invitar dentro de su cuota (evaluado app-layer).                                     |
| grupo con `members:block`          | puede expulsar (no a owners).                                                               |
| invitado                           | persona (por email) con `Invitation` pendiente; la ve/acepta.                               |
| miembro activo                     | sujeto de expulsión / receptor de transferencia.                                            |
| service-role                       | crea/acepta/revoca/reenvía invitaciones; mueve membership/ownership.                        |

## RLS derivada

Helper nuevo (`SECURITY DEFINER`, D1 del README): **`is_invitee(inv_email
TEXT) → bool`** — `true` si `inv_email` = el `email` del `User` de
`auth.uid()`. (Lee `User`; DEFINER para no romper cuando `User` tenga
RLS.) Reusa `is_place_admin` (DEFINER).

### `Invitation`

| Op     | Quién                                               | Policy                                                                                                                                                                                                                          |
| ------ | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SELECT | el invitado (por email) **o** admin/owner del place | `"Invitation_select_invitee_or_admin"`: `public.is_invitee("email") OR public.is_place_admin("placeId")`. Cubre el flujo **en-app por email** (el invitado lista las suyas) y la vista de pendientes en settings (admin/owner). |
| INSERT | — (deny)                                            | service-role. La invite-policy + cuotas del place se evalúan **app-layer** antes de insertar; RLS no las expresa (son configurables y con estado de cuota — no modelables en una policy estática).                              |
| UPDATE | — (deny)                                            | service-role: aceptar (`acceptedAt`), revocar, reenviar, marcar delivery.                                                                                                                                                       |
| DELETE | — (deny)                                            | service-role (revocar = borrar o marcar; según implementación de la feature).                                                                                                                                                   |

**Flujo token**: la accept page resuelve la invitación por `token`
**server-side (service-role)** — no requiere policy de cliente por
token (un token en URL no debe depender de RLS; el server valida token

- expiración + place no archivado). El SELECT de cliente es solo para
  el flujo en-app por email.

### `Membership` / `PlaceOwnership` (lifecycle)

Ya documentados en `place-access.md`:

- `Membership` INSERT/UPDATE/DELETE = deny (service-role): aceptar
  invitación crea la fila; expulsar/salir setea `leftAt`.
- `PlaceOwnership` INSERT/UPDATE/DELETE = deny (service-role): transfer
  ownership con invariante "mín 1 owner".

La RLS no cambia por esta feature — sigue siendo "escritura
service-role". Lo que esta feature agrega es **quién dispara** esas
escrituras (invite-policy, members:block, transfer), todo evaluado
server-side.

## Pendientes (feature aparte, registrados)

1. **Invite-policy + cuotas configurables** — modelo nuevo
   (¿`PlaceInviteSettings`? quién puede invitar: owner/grupos/tiers/
   users/todos; cuotas por scope) + área de config general del place en
   `/settings` (a crear). La RLS de `Invitation` ya queda lista; la
   policy de quién-invita es app-layer sobre ese modelo.
2. **Expulsión vía `members:block`** — verificar/implementar la action
   server-side (el permiso existe en el catálogo; la mecánica de
   `leftAt`/bloqueo se confirma al implementar).
3. **Transfer ownership** server-side con invariante "mín 1 owner"
   (feature 2.F histórica — confirmar estado de implementación).
4. **Área de settings general del place** — contenedor de la
   invite-policy y otras configs (discoverable, etc.).

Estos pendientes NO bloquean la RLS de `Invitation`: la policy SELECT +
deny de escritura quedan correctas independientemente de cuándo se
implemente la invite-policy.
