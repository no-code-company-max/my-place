# Modelo de PermissionGroups + Block/Expel + eliminación del rol Admin

**Fecha:** 2026-05-02
**Estado:** Aceptada
**Origen:** G.0 del plan PermissionGroups
(`docs/plans/2026-05-02-permission-groups-and-member-controls.md`).

## Contexto

El producto tiene hoy 3 roles hardcoded — `OWNER`, `ADMIN`, `MEMBER`
— enforced via `Membership.role` enum + `PlaceOwnership` table. La
moderación se gateia con `role === 'ADMIN' || isOwner` en ~228
callsites repartidos por ~72 archivos.

El user pidió un sistema de **grupos de moderación con permisos
delegables** (estilo SMF, Discord, Discourse). El análisis de
opciones (rol único nuevo "Moderator" vs grupos atómicos vs
config per-object) cerró en **híbrido grupos + override por library
category**: grupos globales con permisos atómicos para discussions,
events, flags y members; library además permite scope por
categoría (extensión natural del `designated contributors`
existente).

Adicionalmente, el user decidió **eliminar el rol `ADMIN`** y
sumar **block** (delegable) y **expel** (owner-only) con emails
Resend.

El plan completo ejecutable está en
`docs/plans/2026-05-02-permission-groups-and-member-controls.md`.
La spec del feature está en `docs/features/groups/spec.md`. Este
ADR registra las decisiones de modelado que abrieron debate y se
cerraron antes de implementar.

## Decisiones

### 1. Eliminar el rol `ADMIN` del enum `MembershipRole`

**Pregunta original**: ¿conviene mantener el rol `ADMIN` como
"shortcut" para "tiene todos los permisos atómicos", o eliminarlo
y modelarlo como un grupo preset?

**Decisión**: eliminar. Se modela como grupo preset
"Administradores" auto-generado por place con TODOS los permisos
atómicos.

**Razones**:

- **Coherencia ontológica**: si tenemos grupos con permisos
  atómicos, admin es un grupo preset más. Mantener ambos
  conceptos en paralelo (rol enum + grupos) es deuda.
- **Discord / Discourse modernos** lo hacen así. "Administrator"
  es un permiso, no un rol.
- **Simplifica la UX del owner**: un único lugar de gestión de
  privilegios (grupos). El "rol Admin" desaparece de la UI;
  asignar al grupo "Administradores" es UX equivalente a "promover
  a admin" del modelo anterior.
- **Reduce código**: chau chequeos `role === 'ADMIN'` esparcidos.

**Trade-off aceptado**: refactor masivo de **~228 callsites en ~72
archivos** (audit-corregido). Pagamos la deuda ahora porque alinea
todo el modelo a un único pattern. La estrategia de coexistencia
(branch fallback en `hasPermission` durante G.1.5–G.7) permite
migrar uno a uno sin romper en flight.

**Decisión rechazada**: mantener `role === 'ADMIN'` como columna
denormalizada actualizada por triggers cuando se asigna/remueve del
grupo Administradores. Demasiado clever; introduce drift potential
(triggers fallan, columna queda inconsistente). Mejor un único
source of truth (groups).

### 1.bis Estrategia de migración de `Invitation.asAdmin`

`Invitation.asAdmin` es campo existente que determina el `role` al
aceptar la invitation (`acceptInvitationAction` setea `role='ADMIN'`
si es true).

**Decisión** (validada por audit): la columna `asAdmin` PERMANECE
intacta. En G.3, `acceptInvitationAction` cambia para que cuando
`asAdmin=true`, en lugar de setear `Membership.role='ADMIN'`
(deprecado), inserta un `GroupMembership` al grupo preset
"Administradores" del place.

**Razones**:

- **Sin cambios al flow del inviter**: el form de invitar sigue
  teniendo "Invitar como admin" checkbox que setea `asAdmin=true`.
  Cero cambios en UX.
- **Sin migración de invitations pendientes**: las invitations
  abiertas con `asAdmin=true` se materializan correctamente al
  aceptar bajo el nuevo modelo.
- **Útil como metadato**: `asAdmin` distingue "invitada como admin"
  de "invitada como member común" en la lista de pending. Sigue
  siendo señal del intent del inviter.

`asAdmin` columna NO se borra en G.7 — se mantiene como metadato.

### 2. 10 permisos atómicos (lista cerrada v1)

Hardcoded enum en `groups/domain/permissions.ts`:

```
discussions:hide-post
discussions:delete-post
discussions:delete-comment
library:moderate-items
library:moderate-categories
events:moderate
flags:review
members:invite
members:block
members:resend-invitation
```

**Razones del corte**:

- **Cubre 100% de las acciones de moderación que existen hoy**
  (audit confirmó). No hay actions de moderación huérfanas sin
  permiso.
- **Hide vs Delete separados** en discussions: hide es reversible,
  delete destructivo. Algunos owners querrán mods con hide pero no
  delete.
- **Bundling pragmático en library**: `moderate-items` (archive
  ajenos) y `moderate-categories` (CRUD categorías + designated)
  separados porque son acciones distintas, pero ambos scopables a
  nivel categoría.
- **Bundling máximo en events y flags**: editar y cancelar evento
  son la única moderación de events; flags es 1 permiso bundle
  porque internamente ya tiene los sideEffects.
- **`members:invite` separado** de `members:resend-invitation`:
  permite "Recruiters" que invitan sin poder reenviar
  recordatorios (caso edge raro, pero costo cero separar).
- **`members:block` como permiso atómico** (decisión #6 user
  2026-05-02): bloquear/desbloquear es delegable a un grupo.
  Expel queda owner-only.

**NO incluido y por qué**:

- `discussions:edit-post` (editar contenido ajeno): destructivo
  del intent del author. Hoy admin puede editarlo, pero esa
  capacidad NO se delega — si alguien quiere editar contenido
  ajeno, debe ser admin (en grupo "Administradores").
- `discussions:edit-comment`: no existe hoy (admin tampoco puede
  editar comments ajenos).
- `tiers:*`: hoy owner-only. Si en futuro se delega, se suma
  `tiers:assign-to-member` como permiso aparte.
- `members:expel`: explícitamente owner-only por decisión user.
- `members:invite-admin`: invitar como admin también queda
  owner-only (capacidad sensible). El permiso `members:invite`
  invita SOLO como member común.

### 3. Owner es dios implícito

El owner siempre tiene TODOS los permisos atómicos sin necesidad
de estar en grupos. La función `hasPermission` arranca con
`if (await findPlaceOwnership(userId, placeId)) return true`.
Owner NO aparece como member de grupos en la UI ni puede
asignársele a ninguno (chequeo en server action — `target_is_owner`
discriminator si se intenta).

**Razón**: el owner es el "creator/dueño" del place. Tener todos
los permisos no es delegación — es propiedad. Modelar al owner
como member de un grupo lo confundiría con "admin" cuando en
realidad es superior (puede transferir ownership, expulsar, etc.).

### 4. Grupo preset "Administradores" auto-generado

Al crear un place (vía `createPlaceAction`), se auto-genera un
`PermissionGroup` con `name='Administradores'`, `isPreset=true`,
`permissions=PERMISSIONS_ALL`. En places existentes, la migration
data lo crea retroactivamente.

**Hardcoded checks**:

- **No se puede eliminar** (`deleteGroupAction` retorna
  `{ ok: false, error: 'cannot_delete_preset' }`).
- **No se pueden modificar permisos** del preset
  (`updateGroupAction` retorna
  `{ ok: false, error: 'cannot_modify_preset' }` si intenta
  cambiar `permissions`). Sí se puede cambiar `name` y
  `description` (UX — owner puede renombrarlo a "Equipo de
  moderación" si prefiere).
- **No se puede scopear el preset a categorías**
  (`setGroupCategoryScopeAction` retorna
  `{ ok: false, error: 'cannot_scope_preset' }`). El preset es
  intencionalmente global.

**Razones**:

- **Failsafe**: siempre hay un grupo con todos los permisos. Si
  algo se rompe en grupos custom, el preset cubre.
- **Patrón conocido**: como rol "Admin" anterior, pero modelado
  como grupo. UX equivalente para el owner.
- **Migración trivial**: admins existentes → miembros del preset.

### 5. Library scoped por categoría

Tabla `GroupCategoryScope` permite limitar `library:moderate-items`
y `library:moderate-categories` a categorías específicas.

**Semántica**:

- Sin entries en `GroupCategoryScope` para ese grupo + permiso
  library → **global** (todas las categorías).
- Con entries → **solo** esas categorías.

**Razones**:

- **Caso de uso real**: place con categorías "Recetas",
  "Tutoriales", "Anuncios". Owner quiere mod específico para
  "Recetas" sin poder tocar las demás. Es el override por recurso
  más solicitado (decisión #2 user).
- **Library tiene scope natural**: las categorías son agrupadores
  explícitos. Discussions (threads planos) y events (eventos
  individuales) NO tienen agrupador equivalente — por eso esos
  permisos son globales.
- **Patrón existente reutilizable**: el `LibraryCategoryContributor`
  table de library R.7 ya hace algo análogo (designated
  contributors a nivel categoría). El scope de moderación es la
  misma idea aplicada a moderación.

**Otros permisos NO scopables**:

- `discussions:*`: no hay sub-categorías en discussions.
- `events:moderate`: no hay sub-categorías de eventos.
- `flags:review`: el flagging es universal por place.
- `members:*`: universal por place.

### 6. Schema: `permissions` como Postgres array, NO tabla normalizada

`PermissionGroup.permissions String[]` (Postgres `text[]`).

**Razones**:

- **Pragmatismo para 10 permisos estables**: no vale la pena tabla
  - FK + JOIN para 10 valores que rara vez cambian.
- **Performance**: query "user X tiene permiso Y" se hace con
  `permissions: { has: 'discussions:hide-post' }` en Prisma →
  GIN index sobre el array es eficiente para `@>`.
- **Validación Zod**: server actions validan que cada string del
  array está en el enum hardcoded. Drift entre array y enum es
  prevenido en cada INSERT/UPDATE.

**Trade-off aceptado**: si alguien corrompe la columna en DB
(ALTER TABLE manual), la app puede tener "permisos" inválidos.
Mitigación: validación en runtime en `hasPermission` (filtra
permisos no reconocidos).

**Cuándo migrar a tabla normalizada**: si la lista crece > 30
permisos o si necesitamos metadata por permiso (ej:
`assignedAt`, `expiresAt` por permiso individual). En ese momento,
ADR aparte + migration data del array → rows.

### 7. Hard-delete de grupos con pre-condición

`deleteGroupAction({ groupId })` requiere que el grupo NO tenga
miembros asignados. Si tiene → return discriminated union
`{ ok: false, error: 'group_has_members' }`. Owner debe quitar a
los miembros primero.

Excepción: el grupo preset "Administradores" NO se puede eliminar
NUNCA (`cannot_delete_preset`).

**Razones** (decisión #2 user 2026-05-02):

- **Soft-delete agrega ruido**: si dejamos `archivedAt` en
  PermissionGroup, hay que filtrar en cada query. Para grupos
  custom donde el owner tiene control directo, hard-delete es más
  limpio.
- **Pre-condición explícita**: forzar al owner a "vaciar el grupo"
  antes de eliminar es señal clara de intent. Evita borrar
  accidentalmente N memberships.
- **GroupMembership cascade**: si tuviéramos cascade delete, un
  grupo eliminado borraría N memberships en silencio. Pre-condición
  evita el accidente.

**Decisión rechazada**: soft-delete con `archivedAt`. Over-engineering
para grupos que el owner gestiona directo.

### 8. Block como permiso atómico, expel como owner-only

`members:block` es permiso atómico (puede ir en grupos custom).
Expulsión es owner-only hardcoded (NO permiso atómico).

**Razones**:

- **Block es reversible** (admin puede deshacer). Apropiado para
  delegación a moderadores.
- **Expel es destructivo** (forzar `leftAt`, ex-miembro debe ser
  re-invitado). Decisión grave que sólo el owner debe poder tomar.
- **User dixit (decisión 2026-05-02)**: "expulsion siempre
  depende del owner".

**Decisión rechazada**: `members:expel` como permiso atómico
también. Sería inconsistente con la decisión cerrada del user +
abriría riesgo de moderadores expulsando por venganza.

### 9. Email Resend en block/unblock/expel con email de contacto editable

Modal con form `{ motivo: textarea required, contactEmail: input default=actorEmail }`.
El email del actor se autocompleta editable. Se envía email Resend
al miembro afectado con el motivo + email de contacto.

**Razones** (decisión #5 user 2026-05-02):

- **Transparencia con el miembro**: bloqueo/expulsión no debe ser
  silenciosa. El miembro merece saber por qué + cómo contactar.
- **Email de contacto editable**: admin puede usar otro email
  distinto al de su cuenta (ej: email del equipo, email del
  trabajo). Default es su email de cuenta para reducir fricción.
- **Email también al desbloquear**: el miembro merece saber que su
  acceso fue restaurado (cortesía).

**Anti-phishing UI hint** (audit-fix): el modal incluye texto
explicativo "Este email se enviará al miembro. NO uses un email
ajeno." Server action valida shape Zod (`email()`) pero NO bloquea
overrides legítimos.

**Manejo de errores en send**: si Resend falla, la action de
block/expel se commitea igual (es la intención principal); el
email queda como log warning. UI muestra toast "Acción ejecutada
pero el email no pudo enviarse — contactá manualmente."

### 10. Block soft + indefinido v1

`Membership.blockedAt DateTime?`. Soft-block: membership persiste
pero gate rechaza acceso. Reversible. Sin `blockedUntil` v1
(bloqueo indefinido hasta unblock manual).

**Razones**:

- **Suficiente v1**: el caso "bloquear hasta que el miembro se
  comporte" se cubre con bloqueo indefinido + unblock manual.
- **Bloqueo temporal con `blockedUntil`** suma cron de unbloqueo
  automático + UI "Bloquear por N días". Diferido — si emerge
  necesidad, plan futuro.

### 11. Expel = `leftAt` con metadata

`Membership.leftAt = now()` + nuevos campos
`expelledByUserId`, `expelReason`, `expelContactEmail`.

**Razones**:

- **Reusa el flow existente**: `leftAt` ya marca membership
  inactiva. Gates ya rechazan users con `leftAt`. Erasure 365d
  ya procesa estas memberships. Cero cambios al flow downstream.
- **Distingue voluntario de forzado**: `expelledByUserId IS NULL`
  → leave voluntario. `expelledByUserId IS NOT NULL` → expel.
  Diferenciación útil para audit + futuro UI ("Histórico de
  expulsados").

### 12. Gate order en `(gated)/layout.tsx`

```ts
// 1. Auth → redirect login si no.
// 2. Membership activa (leftAt IS NULL) → 404 si no.
// 3. blockedAt IS NULL → si NO, render <UserBlockedView>.
// 4. Place open por horario → si NO, render <PlaceClosedView>.
// 5. Render children (zona del place).
```

**Razón** (audit-fix): bloqueo es acción específica sobre el user;
horario es constraint del lugar. Si ambas aplican, el user ve la
más específica primero (`<UserBlockedView>`). Cuando se desbloquea
y el lugar sigue cerrado, ve `<PlaceClosedView>`. Coherencia
semántica preservada.

### 13. Discriminated union return para errores esperados

Aplicado a las 9 actions. Ver tabla completa en
`docs/features/groups/spec.md` § 12.

**Razón**: gotcha CLAUDE.md (2026-05-02). Next 15 NO preserva
propiedades custom de un Error tirado desde Server Action — el
cliente recibe `digest` + 500 opaco. Para errores esperados del
flujo, return discriminated union es el patrón correcto.

### 14. Audit script + validación de data migration

Prisma NO soporta data migrations puras (sólo DDL). Por eso el
plan G.1 incluye:

- `prisma/migrations/<ts>_permission_groups_schema/migration.sql`
  (DDL solo).
- `scripts/migrate-admins-to-groups.ts` (script tsx idempotente).
- `scripts/validate-admins-migration.ts` (assertion automática).

**Razón** (audit-fix): si en CI alguien corre `prisma migrate
deploy` sin el script TS, los admins no migran y los gates
fallan. Validación post-migration garantiza equality.

## Implicancias

- **Migration**: 2 archivos SQL (G.1 + G.7) + 2 scripts TS (G.1
  para data + validación).
- **Slice**: `src/features/groups/` con ~20 archivos, estimado
  ~1600 LOC (excede cap default por ~100). Pre-aprobada decisión
  binaria de split a 2 slices o ADR de excepción si se confirma
  en G.2.
- **Refactor**: ~228 callsites + ~72 archivos en G.3. Mayor
  trabajo individual del proyecto.
- **Tests**: + ~300 tests nuevos esperados (unit + RTL + E2E).
- **Boundaries**: `groups/` importa sólo `members/public(.server)`
  (para `hasPermission`) y `tiers/public.server` (para mostrar
  tier name en UI si es necesario). Unidirección preservada.
- **Performance**: `hasPermission` cacheado con `React.cache`. Para
  150 miembros × 5-10 grupos × 10 permisos, queries indexados son
  rápidos. Si emerge bottleneck en places grandes, sumar
  denormalización.

## Cuándo revisar

- **Cuando emerja necesidad de override por evento/thread
  individual**: extender el patrón de `GroupCategoryScope` a otros
  recursos (ej: `GroupEventScope`).
- **Cuando llegue audit log de moderación**: sumar tabla
  `ModerationLog` que registra quién hidió/eliminó qué cuándo.
  Reutiliza el snapshot pattern.
- **Cuando emerja necesidad de bloqueo temporal**: sumar
  `Membership.blockedUntil DateTime?` + cron de unblock automático.
- **Cuando llegue Stripe Connect (Fase 3)**: `members:expel` puede
  evolucionar para considerar suscripciones activas (no expulsar
  un miembro con suscripción paga sin refund).
- **Cuando llegue plan unificado de RLS**: sumar policies sobre
  `PermissionGroup`, `GroupMembership`, `GroupCategoryScope`.
- **Si > 30 permisos atómicos**: migrar `permissions String[]` →
  tabla normalizada `GroupPermission(groupId, permission)`.
- **Si emerge necesidad de roles parametrizados** (ej: "Moderador
  de las categorías que el user es designated en"): rediseñar
  `GroupCategoryScope` para soportar derivación dinámica.

## No aplica

Este ADR **no** autoriza:

- Asignar tiers vía grupo (tiers sigue owner-only). Si en futuro
  se delega, ADR aparte.
- Aprobar posts antes de publicar (no existe queue de moderación
  en v1).
- Override de permisos a nivel de evento/thread individual (sólo
  library categoría tiene scope).
- Bloqueo temporal con auto-unblock (sin cron v1).
- Bypass del owner-only de expel para algún rol especial.

## Referencias

- `docs/features/groups/spec.md` — spec completa.
- `docs/plans/2026-05-02-permission-groups-and-member-controls.md` —
  plan ejecutable con sub-fases.
- `docs/decisions/2026-05-02-tier-model.md` — ADR de Tier (decisión
  #1 owner-only para tier CRUD; este plan respeta).
- `docs/decisions/2026-05-02-tier-memberships-model.md` — ADR de
  TierMembership (cardinality N + scope owner-only para asignación;
  este plan respeta).
- `docs/decisions/2026-04-24-erasure-365d.md` — patrón snapshot.
  v1 NO usa snapshot para `blockedBy`/`expelledBy` — aceptado en
  spec como diferido.
- `docs/decisions/2026-05-01-stripe-deferred-to-phase-3.md` —
  Stripe diferido (justifica que `tiers:*` no entran como permisos
  v1).
- `docs/decisions/2026-05-01-rls-comprehensive-pre-launch.md` — RLS
  unificado deferred.
- `CLAUDE.md` § Gotchas — discriminated union return,
  connection_limit, snapshot pattern.
