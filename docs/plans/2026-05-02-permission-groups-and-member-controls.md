# Plan — PermissionGroups + Block/Expel + eliminar Admin (G.x)

## Context

El producto tiene hoy 3 roles hardcodeados — `OWNER`, `ADMIN`, `MEMBER`
— enforced via `Membership.role` enum + `PlaceOwnership` table. La
moderación se gateia por `role === 'ADMIN' || isOwner` en cada
server action y page.

Este plan introduce **PermissionGroups con permisos atómicos** —
modelo que permite al owner crear grupos custom (ej: "Moderadores
de Library", "Recruiters") con lista de permisos, y asignar miembros
a esos grupos. **Elimina el rol `ADMIN`** del enum y migra a un grupo
preset llamado **"Administradores"** que se autogenera por place con
TODOS los permisos atómicos.

Adicionalmente, suma dos features de control sobre miembros:

- **Block / Unblock**: soft-block (miembro pierde acceso pero
  conserva membership). Permiso atómico — cualquier grupo puede
  tener `members:block`. Email a Resend al bloquear y al desbloquear.
- **Expel**: hard-leave forzado por owner (miembro queda como
  ex-miembro). Email Resend al expulsar. **Owner-only hardcoded**,
  NO es permiso atómico delegable.

**Por qué eliminar Admin**: si tenemos grupos con permisos atómicos,
el rol `ADMIN` es deuda redundante. Discord/Discourse modernos
funcionan así (Administrator es un permiso, no un rol). Trade-off:
refactor grande (~30 callsites). Pago la deuda ahora porque alinea
todo el modelo de permisos a un único pattern.

**Decisión cerrada (2026-05-02 user)**: ver § Decisiones de modelo
para los 7 puntos validados.

## Scope v1 (cerrado)

**Entra**:

- Modelos `PermissionGroup`, `GroupMembership`, `GroupCategoryScope`
  (Prisma) + migration aplicada al cloud dev.
- Slice nuevo `src/features/groups/`:
  - Domain: enum de los 10 permisos atómicos + helpers + invariants.
  - Server queries: `listGroupsByPlace`, `findGroupById`,
    `listGroupsForUser`, `hasPermission`, `listAllowedCategoryIds`.
  - Server actions: `createGroup`, `updateGroup`, `deleteGroup`,
    `addMemberToGroup`, `removeMemberFromGroup`, `setGroupCategoryScope`.
  - UI: `<GroupsListAdmin>`, `<GroupFormDialog>`,
    `<GroupMembersDialog>`, `<MemberGroupsControl>` (en detalle del
    miembro), `<CategoryScopeSelector>`.
  - Schemas Zod, errors, public.ts/.server.ts.
- Migration data: crea grupo preset "Administradores" por cada place
  con TODOS los permisos atómicos. Migra todos los `Membership.role
= 'ADMIN'` a `GroupMembership` del grupo "Administradores".
- Refactor masivo de TODOS los callsites que chequean role:
  `perms.role === 'ADMIN' || perms.isOwner` →
  `await hasPermission(actorId, place.id, 'X')`.
- Block/unblock:
  - `Membership.blockedAt`, `blockedByUserId`, `blockedReason`,
    `blockedContactEmail`.
  - Server actions `blockMemberAction`, `unblockMemberAction`. Permiso
    atómico `members:block`.
  - Email Resend con template (block + unblock).
  - Gate `(gated)/layout.tsx` rechaza con `<UserBlockedView>` si
    `blockedAt IS NOT NULL`.
- Expel:
  - Server action `expelMemberAction` (owner-only hardcoded).
  - Setea `Membership.leftAt = now()` + nuevos campos
    `expelledByUserId`, `expelReason`, `expelContactEmail`.
  - Email Resend con template específico.
- Page `/settings/groups` (owner-only) — CRUD de grupos.
- Detalle del miembro (`/settings/members/[userId]`) extendido:
  - Sección "Grupos asignados" + agregar/remover (permiso `manage-groups`
    o owner-only — ver decisiones).
  - Botón "Bloquear miembro" → modal con motivo + email contacto.
  - Botón "Expulsar miembro" (sólo owner) → modal análogo.
- Drop `Membership.role` columna + drop `MembershipRole` enum tras
  refactor completo (G.7).
- Spec `docs/features/groups/spec.md` + ADR
  `docs/decisions/2026-05-02-permission-groups-model.md`.
- Tests unit + RTL + E2E.

**Fuera de v1 (explícito)**:

- **Aprobar posts antes de publicar** (queue de moderación previa).
  Confirmado fuera de scope por user.
- **Override por recurso individual** (e.g., moderador de un thread
  específico). Sólo library categoría tiene scope. Resto global.
- **Audit log de moderación** (quién hidió/eliminó qué cuándo).
  Diferido.
- **Notificaciones push** al miembro bloqueado/expulsado. Solo
  email Resend en v1.
- **RLS policies** sobre las nuevas tablas. Diferido al plan
  unificado de RLS.
- **Templates de grupos** ("Crear con preset Moderador básico").
  v1 sólo "Administradores" preset; resto se crea custom. UX layer
  encima si aparece demanda.
- **Bulk operations** (asignar N miembros a un grupo a la vez).
- **Permisos sobre tiers** (asignar tier es delegable a un grupo).
  Hoy owner-only. Si en futuro se delega, se suma `tiers:assign`
  como permiso atómico aparte.

## Decisiones de modelo

### 1. Eliminar el rol `ADMIN` del enum

`MembershipRole` enum se reduce a `MEMBER` única (o se elimina
completamente y la columna `Membership.role` se borra). Razones:

- Coherencia: si tenemos grupos con permisos atómicos, admin es
  un grupo preset más.
- Discord / Discourse modernos lo hacen así.
- Reduce código: chau chequeos `role === 'ADMIN'` esparcidos.

**Trade-off (audit-corregido 2026-05-02)**: refactor grande de
**~228 hits en ~72 archivos** (no ~30 como estimación inicial). El
audit explícito vive en G.3 — primer paso del agente B es correr el
grep y producir checklist exhaustiva.

**Estrategia de migración** (clave para no romper en flight):

1. **G.1**: schema con NUEVA tabla + grupo preset + migración data
   `Membership.role === 'ADMIN'` → asignación al grupo
   "Administradores". `Membership.role` columna **PERMANECE** (no se
   borra todavía).
2. **G.1.5**: `hasPermission(userId, placeId, permission, opts?)`
   stub que **mantiene compat**: chequea isOwner OR
   (role === 'ADMIN') OR (membership a grupo con permiso). El
   branch role === 'ADMIN' es FALLBACK durante la transición.
3. **G.2**: implementación real de la API basada en grupos.
4. **G.3**: refactor masivo de callsites. Cada callsite migrado se
   valida con tests. Durante esta fase, callsites no migrados
   siguen funcionando vía el fallback.
5. **G.7**: drop `Membership.role` columna + `MembershipRole` enum.
   Drop el branch fallback. Cleanup final.

**Sub-decisión: `Invitation.asAdmin`** (campo existente que
determina role al aceptar). Estrategia validada por audit:

- **G.1**: `Invitation.asAdmin` columna PERMANECE intacta.
- **`acceptInvitationAction` refactor en G.3**: cuando se acepta una
  invitation con `asAdmin = true`, en lugar de setear
  `Membership.role = 'ADMIN'` (deprecado), asignar al user al
  grupo preset "Administradores" (insertar `GroupMembership`).
  Misma semántica end-user, distinto storage.
- **G.7**: la columna `asAdmin` PUEDE mantenerse (es metadato útil
  para la lista de pending invitations y para distinguir intent del
  inviter). NO se borra. Sólo cambia cómo se materializa al aceptar.

### 1.bis Audit script + validación de data migration

**Audit fix**: Prisma NO soporta data migrations como SQL puro — DDL
solo. La migración `Membership.role='ADMIN'` → grupo
"Administradores" requiere un **script TS aparte** que corre como
post-deploy hook.

Deliverables de G.1:

- `prisma/migrations/<ts>_permission_groups_schema/migration.sql` —
  DDL: tablas + back-relations + indexes. **NO** toca data.
- `scripts/migrate-admins-to-groups.ts` — script tsx que:
  1. Por cada place existente, crea `PermissionGroup` con
     `name='Administradores'`, `isPreset=true`,
     `permissions=PERMISSIONS_ALL`.
  2. Para cada `Membership` con `role='ADMIN'` activo (`leftAt IS NULL`),
     crea `GroupMembership(groupId, userId, placeId)`.
  3. Idempotente: chequea con `findFirst` antes de crear cada row.
- `scripts/validate-admins-migration.ts` — script tsx assertion:
  - Cuenta admins activos pre-migration: `SELECT COUNT(*) FROM "Membership" WHERE role='ADMIN' AND leftAt IS NULL`.
  - Cuenta group memberships del preset: `SELECT COUNT(*) FROM "GroupMembership" gm JOIN "PermissionGroup" pg ON gm.groupId=pg.id WHERE pg.isPreset AND pg.name='Administradores'`.
  - Cuenta places: `SELECT COUNT(*) FROM "Place" WHERE archivedAt IS NULL`.
  - Assert: admin count == groupMembership count, AND placeCount == groupCount (uno por place).
  - Exit code distinto si falla.
- En CI: `pnpm prisma:migrate:deploy && pnpm tsx scripts/migrate-admins-to-groups.ts && pnpm tsx scripts/validate-admins-migration.ts`.
- Sumar a `package.json` script: `"migrate:admins-to-groups"` que ejecuta el flow completo.

### 2. Owner es dios implícito

Owner siempre tiene TODOS los permisos atómicos sin necesitar estar
en grupos. La función `hasPermission` arranca con
`if (await findPlaceOwnership(userId, placeId)) return true`. Owner
NO aparece como member de grupos en la UI ni puede asignársele a
ninguno (chequeo en server action).

### 3. Grupo preset "Administradores" por place

Auto-generado en cada place existente (vía migration data) y en cada
place nuevo (vía `createPlaceAction` extendido). Tiene TODOS los
permisos atómicos asignados. **NO se puede eliminar** (hardcoded
check en `deleteGroupAction`). Owner asigna miembros normalmente.

UX: aparece en `/settings/groups` con icono distintivo + descripción
"Tiene todos los permisos editoriales". Equivalente conceptual al
rol ADMIN previo, pero modelado como grupo.

### 4. Lista de 10 permisos atómicos (cerrada)

```
discussions:hide-post              ocultar/des-ocultar posts ajenos
discussions:delete-post            hard-delete posts ajenos
discussions:delete-comment         soft-delete comments ajenos
library:moderate-items             archivar items ajenos (scopable por categoría)
library:moderate-categories        editar/archivar categorías + designated contributors (scopable)
events:moderate                    editar / cancelar events ajenos
flags:review                       revisar flags + ejecutar sideEffects
members:invite                     invitar members (no admins)
members:block                      bloquear/desbloquear acceso de un miembro
members:resend-invitation          reenviar invitación pending
```

Owner-only hardcoded (NO permisos atómicos):

- Expulsar miembros (`leftAt` forzado).
- Transferir ownership.
- CRUD de tiers + asignación de tiers.
- CRUD de grupos + asignación de miembros a grupos.
- Settings del place (theme, hours, billing).
- Archivar el place.

### 5. Library scoped por categoría

Tabla `GroupCategoryScope` permite limitar `library:moderate-items`
y `library:moderate-categories` a categorías específicas.

**Semántica**:

- Sin entries en `GroupCategoryScope` para ese grupo + permiso
  library → **global** (todas las categorías).
- Con entries → **solo** esas categorías.

`hasPermission` para acciones library acepta opcionalmente
`categoryId` y chequea el scope. `listAllowedCategoryIds(userId,
placeId, permission)` retorna las categorías donde el user puede
ejecutar la acción (todas si grupo global, las del scope si
restringido).

### 6. Hard-delete de grupos con pre-condición

`deleteGroupAction({ groupId })` requiere que el grupo NO tenga
miembros asignados. Si tiene → return discriminated union
`{ ok: false, error: 'group_has_members' }`. Owner debe quitar a los
miembros primero.

Excepción: el grupo preset "Administradores" NO se puede eliminar
NUNCA (hardcoded check). Sí se puede vaciar (quitar todos los
members) — pero el grupo persiste.

### 7. Block + Expel con email Resend

**Block** (cualquier user con permiso `members:block` puede ejecutar):

- Soft: setea `Membership.blockedAt = now()`. Reversible.
- Email Resend al bloqueado con: motivo redactado por el admin +
  email de contacto del admin (autocompleta su email de cuenta,
  editable en el modal).
- Gate `(gated)/layout.tsx` rechaza con `<UserBlockedView>` que
  muestra "Estás bloqueado de [place]. Contactá a [contact email]
  si querés discutirlo."
- Unblock también dispara email (más breve, "Tu acceso fue
  restaurado en [place]" + contact email del admin).
- Persiste en `Membership`: `blockedAt`, `blockedByUserId`,
  `blockedReason`, `blockedContactEmail`.

**Expel** (owner-only hardcoded):

- Setea `Membership.leftAt = now()` con metadata de owner. Mismo
  efecto que leave voluntario pero forzado.
- Email Resend con motivo + contact email del owner.
- Persiste en `Membership`: `expelledByUserId`, `expelReason`,
  `expelContactEmail`.
- NO reversible (el ex-miembro debería ser re-invitado).
- Tras 365d entra al flujo de erasure normal.

**UI común**: modal en el detalle del miembro con form
`{ motivo: textarea required max=500, contactEmail: input default=actorEmail }`

- botón "Bloquear y enviar email" / "Expulsar y enviar email".
  Confirmación inline.

**Audit-fix UI hint anti-phishing** (validado por audit 2026-05-02):
el modal incluye texto explicativo arriba del campo `contactEmail`:
"Este email se enviará al miembro para que pueda contactarte. Por
defecto usamos el email de tu cuenta — editalo SOLO si querés que te
contacten en otra dirección. NO uses un email ajeno." Server action
valida shape Zod (`z.string().email()`) pero NO bloquea overrides
legítimos.

### 7.bis Orden de gates en `(gated)/layout.tsx`

**Audit-fix (2026-05-02)**: el layout actual chequea horario y
membership. Sumamos `blockedAt`. Orden importa:

```ts
// 1. Auth (requireAuthUserId)
// 2. Membership activa (leftAt IS NULL)
// 3. ★ blockedAt IS NULL → si NO, render <UserBlockedView>
// 4. Place open por horario → si NO, render <PlaceClosedView>
// 5. Renderear children (zona del place)
```

Bloqueo ANTES de horario porque el bloqueo es una acción explícita
sobre el user específico (más específica que el constraint del
lugar). Si el lugar está cerrado Y el user está bloqueado, ve
`<UserBlockedView>`. Cuando se desbloquea, si el lugar sigue
cerrado, ve `<PlaceClosedView>`. Coherencia semántica preservada.

## Schema (G.1)

```prisma
model PermissionGroup {
  id          String    @id @default(cuid())
  placeId     String
  name        String    @db.VarChar(60)
  description String?   @db.VarChar(280)
  // Lista de permisos atómicos del grupo. Validados Zod en server
  // actions contra el enum hardcoded `Permission` (groups/domain/permissions.ts).
  // Postgres array (text[]) para evitar sumar tabla relacional con un
  // enum chico (10 valores). Si crece > 30, NORMALIZAR a tabla
  // `GroupPermission(groupId, permission)` con FK al enum — ADR aparte
  // entonces. Audit-fix 2026-05-02: hoy aceptable, documentado.
  permissions String[]  // arr de Permission enum strings
  // Hardcoded preset: "Administradores" tiene isPreset=true y NO se
  // puede eliminar (deleteGroupAction lo bloquea). Owner sólo puede
  // editar la lista de members del preset, no su nombre/permisos.
  isPreset    Boolean   @default(false)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  place               Place                  @relation(fields: [placeId], references: [id], onDelete: Cascade)
  groupMemberships    GroupMembership[]
  categoryScopes      GroupCategoryScope[]

  @@index([placeId])
  // Unique soft: dos grupos con mismo nombre case-insensitive son
  // confusos. Igual que tier name dedup, este es app-level (server
  // action chequea + retorna discriminated union 'group_name_taken').
  // No partial unique aquí.
}

model GroupMembership {
  id        String   @id @default(cuid())
  groupId   String
  userId    String
  placeId   String   // denormalizado para queries por place sin join
  addedAt   DateTime @default(now())
  addedByUserId String?  // owner que asignó. SetNull si owner se borra.

  group PermissionGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)
  user  User            @relation("GroupMembershipsAsUser", fields: [userId], references: [id], onDelete: Cascade)
  place Place           @relation(fields: [placeId], references: [id], onDelete: Cascade)
  addedBy User?         @relation("GroupMembershipsAddedBy", fields: [addedByUserId], references: [id], onDelete: SetNull)

  @@unique([groupId, userId])  // un user no puede estar 2 veces en el mismo grupo
  @@index([placeId, userId])   // query: hasPermission para userId en placeId
  @@index([userId])
}

model GroupCategoryScope {
  groupId    String
  categoryId String

  group    PermissionGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)
  category LibraryCategory @relation(fields: [categoryId], references: [id], onDelete: Cascade)

  @@id([groupId, categoryId])
  @@index([categoryId])
}

// Cambios al modelo Membership (G.1):
model Membership {
  // existing fields...
  // Block / unblock:
  blockedAt           DateTime?
  blockedByUserId     String?
  blockedReason       String?  @db.VarChar(500)
  blockedContactEmail String?

  // Expel (forzado por owner):
  expelledByUserId    String?
  expelReason         String?  @db.VarChar(500)
  expelContactEmail   String?
  // expelledAt no necesario — usamos `leftAt` con metadata para
  // distinguir voluntary leave (expelledByUserId=null) de expel
  // (expelledByUserId=owner.id).

  // FK de blockedBy / expelledBy → User (SetNull si user se borra).
  blockedBy  User? @relation("MembershipsBlockedBy", fields: [blockedByUserId], references: [id], onDelete: SetNull)
  expelledBy User? @relation("MembershipsExpelledBy", fields: [expelledByUserId], references: [id], onDelete: SetNull)

  // `role` columna PERMANECE durante G.1-G.6, se elimina en G.7.
  // Permite coexistencia: callsites no migrados siguen funcionando
  // mientras los nuevos chequean permisos atómicos vía hasPermission.
}

// User back-relations a sumar:
model User {
  // existing...
  groupMemberships         GroupMembership[]   @relation("GroupMembershipsAsUser")
  groupMembershipsAddedBy  GroupMembership[]   @relation("GroupMembershipsAddedBy")
  membershipsBlockedBy     Membership[]        @relation("MembershipsBlockedBy")
  membershipsExpelledBy    Membership[]        @relation("MembershipsExpelledBy")
}

// Place back-relations a sumar:
model Place {
  // existing...
  permissionGroups PermissionGroup[]
  groupMemberships GroupMembership[]
}

// LibraryCategory back-relations a sumar:
model LibraryCategory {
  // existing...
  groupScopes GroupCategoryScope[]
}
```

## Slice `groups/` — estructura

```
src/features/groups/
├── domain/
│   ├── permissions.ts      // enum hardcoded `Permission` + lista PERMISSIONS_ALL + helpers (isLibraryScopedPermission)
│   ├── types.ts            // PermissionGroup, GroupMembership, GroupCategoryScope, GroupSummary
│   ├── invariants.ts       // assertGroupName, assertPermissionsValid, assertNotPresetForDelete
│   └── presets.ts          // ADMIN_PRESET_NAME = "Administradores", presetPermissions()
├── server/
│   ├── queries.ts          // listGroupsByPlace, findGroupById, listGroupsForUser, hasPermission, listAllowedCategoryIds
│   └── actions/
│       ├── create-group.ts
│       ├── update-group.ts             // edit name, description, permissions, scope
│       ├── delete-group.ts             // hard-delete con pre-check de members vacíos
│       ├── add-member-to-group.ts
│       ├── remove-member-from-group.ts
│       └── set-group-category-scope.ts
├── ui/
│   ├── groups-list-admin.tsx           // server, lista en /settings/groups
│   ├── group-form-dialog.tsx           // client (form: name + desc + permissions checkboxes + scope)
│   ├── group-members-dialog.tsx        // client (gestión de members del grupo)
│   ├── member-groups-control.tsx       // client (en detalle de miembro: assign/remove a grupos)
│   ├── permission-checkbox-list.tsx    // client (10 checkboxes con descripción humana)
│   ├── category-scope-selector.tsx     // client (multi-select de categories cuando permission es library:*)
│   ├── delete-group-button.tsx         // client (con confirm + chequeo de members)
│   ├── permission-label.tsx            // server (mapping enum → label español)
│   └── errors.ts                       // friendlyGroupErrorMessage
├── __tests__/
│   ├── permissions.test.ts             // enum + helpers
│   ├── invariants.test.ts
│   ├── queries.test.ts                 // hasPermission, listAllowedCategoryIds, etc.
│   ├── create-group.test.ts
│   ├── update-group.test.ts
│   ├── delete-group.test.ts
│   ├── add-remove-members.test.ts
│   └── set-category-scope.test.ts
├── public.ts               // tipos + UI client-safe + Server Actions
├── public.server.ts        // import 'server-only' + queries (incluye hasPermission)
└── schemas.ts              // Zod
```

## Sub-fases

| Sub       | Tema                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Sesiones | Deliverable                                                                                                                                                                                                 | Quién                                       |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| **G.0**   | Spec + ADR (este doc + spec.md + ADR.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | 1        | `docs/features/groups/spec.md` + `docs/decisions/2026-05-02-permission-groups-model.md`                                                                                                                     | Lead                                        |
| **G.1**   | Schema + migration (incluye data migration `role=ADMIN` → grupo Administradores). `Membership.role` columna PERMANECE (drop en G.7).                                                                                                                                                                                                                                                                                                                                                                                                                     | 1        | Migration aplicada al cloud dev. Grupo "Administradores" creado en cada place existente con TODOS los miembros admin asignados.                                                                             | Lead                                        |
| **G.1.5** | Pre-setup stubs compartidos para fan-out paralelo. Crea `groups/domain/permissions.ts` (enum + lista) + `groups/public.ts/.server.ts` skeletons + `members/server/queries.ts` con `hasPermission` stub que mantiene compat (isOwner OR role===ADMIN OR group-membership).                                                                                                                                                                                                                                                                                | 0.5      | Repo en typecheck verde. M.2/M.3/M.4 pueden arrancar paralelo sin tocarse.                                                                                                                                  | Lead                                        |
| **G.2**   | Slice `groups/` skeleton + domain + queries reales (`hasPermission`, `listAllowedCategoryIds`) + 6 actions con discriminated union + UI components + tests dominio + actions.                                                                                                                                                                                                                                                                                                                                                                            | 2        | Slice completo (~20 archivos). API real reemplaza el stub de G.1.5.                                                                                                                                         | Agente A (paralelo con G.3 y G.4)           |
| **G.3**   | Refactor masivo callsites: cada `perms.role === 'ADMIN'` o `perms.isAdmin` → `await hasPermission(actorId, place.id, 'X')`. Tests actualizados. ~30 archivos a tocar across slices (discussions, library, events, flags, members).                                                                                                                                                                                                                                                                                                                       | 2        | Todos los callsites migrados. Tests verde. Branch fallback de G.1.5 sigue activo (drop en G.7).                                                                                                             | Agente B (paralelo con G.2 y G.4)           |
| **G.4**   | Block/unblock + expel: schema field updates ya en G.1, falta actions + Resend templates + gate update + UI dialogs.                                                                                                                                                                                                                                                                                                                                                                                                                                      | 1.5      | Actions `blockMember`, `unblockMember`, `expelMember` + emails Resend funcionando. Gate `(gated)/layout.tsx` rechaza blocked.                                                                               | Agente C (paralelo con G.2 y G.3)           |
| **G.5**   | Page `/settings/groups` (owner-only): lista + crear + editar + eliminar + asignar/remover members. Tests RTL.                                                                                                                                                                                                                                                                                                                                                                                                                                            | 2        | Page completa con flujo CRUD owner-only. Suma item `'groups'` a `SETTINGS_SECTIONS` con `requiredRole: 'owner'`.                                                                                            | Agente D (paralelo con G.6, post G.2)       |
| **G.6**   | Detalle del miembro extendido: sección "Grupos asignados" + assign/remove + botones "Bloquear" y "Expulsar" (owner-only) con modales de motivo + email. Tests RTL.                                                                                                                                                                                                                                                                                                                                                                                       | 2        | Detalle del miembro completo con todos los controles.                                                                                                                                                       | Agente E (paralelo con G.5, post G.2 + G.4) |
| **G.7**   | ✅ **CERRADO** en plan dedicado `~/.claude/plans/tidy-stargazing-summit.md` (cierre ejecutado 2026-05-05). Drop columna `Membership.role` + enum `MembershipRole` + drop fallback + refactor 23 archivos consumers (prod + tests) + refactor SQL helper `is_place_admin` (Migration 1) + DDL drop (Migration 2). ADR `docs/decisions/2026-05-03-drop-membership-role-rls-impact.md`.                                                                                                                                                                     | 0.5+5    | Schema sin columna. `hasPermission` chequea sólo grupos. Subset cleanup verde (53 tests). Build entera bloqueada por 180 errores TS pre-existing de otros planes — fuera de scope (ver ADR § Verificación). | Lead                                        |
| **G.8**   | 🟡 **PARCIAL** en mismo plan dedicado. **Hecho** (C.4): seed extendido con `E2E_GROUPS` + `E2E_GROUP_MEMBERSHIPS` baseline (palermo: `adminPreset` + `moderators` con 3 group memberships). Wipe FK-safe + create idempotente. **Pendiente** (C.5): E2E `permission-groups.spec.ts` con escenarios mutativos (CRUD groups + scope library + permission enforcement) + spec nueva `member-block-expel.spec.ts` con flow block/unblock/expel. Diferido hasta que los pre-existing errors TS se resuelvan (la build no compila → `pnpm test:e2e` no corre). | 1+1.5    | Fixtures completas. Specs diferidos.                                                                                                                                                                        | Lead + Agentes D+E                          |
| **Total** |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | **13.5** |                                                                                                                                                                                                             |                                             |

### Paralelización con agentes — workflow definitivo

Patrón establecido (gotcha CLAUDE.md): **lead crea stubs compartidos
ANTES, agentes paralelizan después**. **Audit-fix 2026-05-02**:
sumamos **gates explícitos** post-G.1.5 y post-batch-1 antes de
spawnear el siguiente batch.

1. **Lead — G.0** (secuencial): spec + ADR.

2. **Lead — G.1** (secuencial): schema migration aplicada al cloud
   dev + script `migrate-admins-to-groups.ts` ejecutado +
   `validate-admins-migration.ts` verifica equality + Prisma
   generate + typecheck verde. **Gate**: el grupo "Administradores"
   existe en cada place + cada admin previo está en `GroupMembership`
   del preset.

3. **Lead — G.1.5** (~30 min): pre-setup stubs compartidos:
   - `groups/domain/permissions.ts` con enum hardcoded + helpers
     (`isLibraryScopedPermission(p)`).
   - `groups/public.ts` + `groups/public.server.ts` skeletons que
     re-exportan stubs (cada export con `throw new Error('TODO G.2')`).
   - `members/server/queries.ts` extendido con
     `hasPermission(userId, placeId, permission, opts?)`:
     - `opts` normalizado por Zod parse interno
       (`hasPermissionOptsSchema`) para garantizar `React.cache`
       dedupe correcta independiente del orden de keys.
     - Body: isOwner OR role===ADMIN (FALLBACK G.1.5–G.7) OR
       groupMembership con permiso.
     - Cached con `React.cache`.
   - `members/server/queries.ts` también con
     `listAllowedCategoryIds(userId, placeId, permission)` stub +
     cached.
   - Stubs de las 6 actions del slice groups (`createGroupAction`,
     etc.) en `groups/server/actions/*.ts` con
     `throw new Error('TODO G.2')`.

   **🚦 Gate pre-batch-1** (lead verifica antes de spawnear):

   ```bash
   pnpm typecheck                         # stubs compilan
   pnpm lint                              # sin warnings
   pnpm test -- members/server/queries    # fallback funciona
   pnpm build                             # prod limpio
   ```

   Si rojo, NO spawnear agentes — fix primero.

4. **Agentes paralelos — Batch 1: G.2 + G.3 + G.4**:
   - **Agente A (G.2)**: slice `groups/` completo. Reemplaza los
     stubs con implementación real. NO toca `members/` ni callsites
     existentes. Tests verde al cerrar.
   - **Agente B (G.3)**: refactor masivo de callsites. **Primer
     paso obligatorio**: correr `grep -rn "role.*ADMIN\|isAdmin\|MembershipRole\|perms\.role" src/ tests/ --include="*.ts" --include="*.tsx"`
     y producir checklist completa (~228 hits / ~72 archivos
     según audit). Migra uno por uno: `if (perms.role === 'ADMIN')`
     → `if (await hasPermission(actorId, place.id, 'X'))`.
     **Especial**: `acceptInvitationAction` cambia para que
     `asAdmin=true` asigne al grupo "Administradores" (insert
     `GroupMembership`) en vez de setear `role='ADMIN'` (deprecado).
     Mientras G.1.5 fallback siga activo, los callsites no migrados
     siguen funcionando. Tests verde por cada callsite migrado.
   - **Agente C (G.4)**: block/unblock + expel. Crea actions +
     Resend templates + extiende `(gated)/layout.tsx` con orden de
     gates `auth → membership → blocked → hours → render` + UI
     dialogs. Importa `hasPermission` desde el stub.

   **🚦 Gate post-batch-1** (lead integra + verifica antes de batch 2):

   ```bash
   # Asume merge de las 3 branches
   pnpm typecheck   # imports de G.3/G.4 ahora consumen API real de G.2
   pnpm lint
   pnpm test        # suite completa unit + boundaries
   pnpm build       # prod limpio
   ```

   Si rojo, fix antes de batch 2 (no spawnear D/E).

5. **Agentes paralelos — Batch 2: G.5 + G.6**:
   - **Agente D (G.5)**: page `/settings/groups` (owner-only) +
     componentes + tests RTL. Sumar item `'groups'` a
     `SETTINGS_SECTIONS` con `requiredRole: 'owner'` antes de
     `'tiers'`.
   - **Agente E (G.6)**: detalle del miembro extendido. Importa
     `<MemberGroupsControl>` de groups (G.2) + dialogs de block/expel
     de G.4. Tests RTL.

   **🚦 Gate post-batch-2** (lead integra):

   ```bash
   pnpm typecheck
   pnpm lint
   pnpm test
   pnpm build
   ```

   Manual smoke owner+admin+member en dev local antes de G.7.

6. **Lead — G.7** (parcial, ejecutado): cleanup mínimo.
   - ✅ Eliminados `promote-to-admin.ts`, `demote-to-member.ts` +
     tests + schemas + re-exports en `members/public.ts`. El rol
     MEMBER↔ADMIN se gestiona vía asignación al grupo preset
     "Administradores" desde la sección "Grupos asignados" del
     detalle de miembro (`role-selector-dialog.tsx` ya eliminado en G.6).
   - ⏸️ **DEFERRED** a un plan unificado posterior (post-G.8):
     - Drop branch fallback `role === 'ADMIN'` en `hasPermission` /
       `listAllowedCategoryIds` — removerlo rompe ~47 tests across 13
       archivos que mockean `mockActiveMember(MembershipRole.ADMIN)` sin
       setear `groupMembership.findMany`.
     - Refactor de los ~33 archivos prod que tipan `MembershipRole`
       (`flags/`, `discussions/`, `library/`, `events/`, `places/`)
       para derivar `isAdmin` desde grupo preset.
     - Refactor de los ~13 archivos de test correspondientes para
       mockear group membership.
     - Drop columna `Membership.role` + enum `MembershipRole` (DDL).
   - Razón del deferral: el cleanup completo es un refactor sistemático
     mecánico que excede el scope original estimado (0.5 sesiones →
     2-3 sesiones) y se beneficia de un plan dedicado con su propia
     auditoría. La compat fallback NO afecta producción — los nuevos
     admins se crean via grupo preset (data migration G.0 + cambio en
     `acceptInvitationAction`); el fallback sólo cubre tests legacy.

7. **Lead — G.8** (secuencial): E2E + cleanup + docs + manual smoke.

Cada sub-fase termina con typecheck + lint + tests + build verde.

**Tiempo total**: 13.5 sesiones (5.5 lead + 8 paralelas con 5
agentes en 2 batches).

### Sobre split opcional de G.3 (audit-fix)

Audit indica que G.3 toca **~35 archivos de producción + ~30 tests
asociados** = trabajo grande para 1 agente en 2 sesiones. Si en la
práctica el agente B se ralentiza, **opción de split por sub-área**:

- **G.3a** (1 agente): `discussions/` + `library/` (~20 archivos
  prod).
- **G.3b** (otro agente): `events/` + `flags/` + `members/` +
  `places/` + `hours/` + `shell/` (~15 archivos prod).

Riesgo: aumenta coordinación. **Decisión por defecto**: 1 agente B.
Si ralentiza, el lead splitea en mid-flight (cancelar agente B,
spawnear B1+B2 con la mitad de la lista cada uno).

## Critical files

**Nuevos**:

- `prisma/migrations/<ts>_permission_groups_schema/migration.sql` (G.1)
- `prisma/migrations/<ts>_drop_membership_role/migration.sql` (G.7)
- `src/features/groups/` (~20 archivos, ver estructura).
- `src/app/[placeSlug]/settings/groups/page.tsx` + componentes de la page (G.5).
- `src/features/members/ui/block-member-dialog.tsx` (G.4 — Client).
- `src/features/members/ui/expel-member-dialog.tsx` (G.4 — Client).
- `src/features/members/ui/user-blocked-view.tsx` (G.4 — Server, montado por gate).
- `src/features/members/server/actions/block-member.ts` (G.4).
- `src/features/members/server/actions/unblock-member.ts` (G.4).
- `src/features/members/server/actions/expel-member.ts` (G.4 — owner-only).
- `src/features/members/server/templates/block-email.ts` (G.4 — Resend template).
- `src/features/members/server/templates/unblock-email.ts` (G.4).
- `src/features/members/server/templates/expel-email.ts` (G.4).
- `docs/features/groups/spec.md`
- `docs/decisions/2026-05-02-permission-groups-model.md`
- `tests/e2e/flows/permission-groups.spec.ts` (G.8).

**Modificados**:

- `prisma/schema.prisma` — modelos `PermissionGroup`,
  `GroupMembership`, `GroupCategoryScope` + cambios a `Membership`,
  `User`, `Place`, `LibraryCategory`. G.7 drop `MembershipRole`.
- `src/features/members/server/queries.ts` — `findMemberPermissions`
  retorna ahora `{ isOwner, permissions: Permission[] }` (sin
  `role`). Sumar `hasPermission`, `listAllowedCategoryIds`,
  `findMemberDetailForOwner` extendido con grupos.
- `src/features/members/server/actions/promote-to-admin.ts` —
  ELIMINAR (deprecado por grupos). G.7.
- `src/features/members/server/actions/demote-to-member.ts` —
  ELIMINAR. G.7.
- `src/features/members/public.ts` + `public.server.ts` — exponer
  block/unblock/expel actions + types nuevos.
- `src/features/places/server/actions.ts:createPlaceAction` —
  extender para crear grupo "Administradores" preset al crear el
  place (G.1).
- `src/app/[placeSlug]/(gated)/layout.tsx` — sumar chequeo de
  `blockedAt` → render `<UserBlockedView>` (G.4).
- `src/app/[placeSlug]/settings/layout.tsx` — sigue gateando
  admin-or-owner; cambia a "tiene cualquier permiso atómico OR
  es owner" — refactor compatible con la nueva API.
- `src/app/[placeSlug]/settings/members/[userId]/page.tsx` —
  agregar sección "Grupos asignados" + botones block/expel (G.6).
- `src/app/[placeSlug]/settings/members/[userId]/components/role-selector-dialog.tsx`
  — ELIMINAR (deprecado). G.7.
- `src/features/shell/domain/settings-sections.ts` — agregar item
  `'groups'` con `requiredRole: 'owner'` inmediatamente antes del
  item `'tiers'`.
- `src/features/shell/__tests__/settings-sections.test.ts` —
  actualizar.
- ~30 archivos con callsites `role === 'ADMIN'` (G.3 los enumera).
  Lista preliminar (auditar al inicio de G.3):
  - `discussions/server/actions/posts/{edit,delete,moderate}.ts`
  - `discussions/server/actions/comments/delete.ts`
  - `library/server/actions/{update-category,archive-category,...}.ts`
  - `events/server/actions/{update,cancel}.ts`
  - `flags/server/actions/review.ts`
  - `members/server/actions/{invite,resend}.ts`
  - Tests asociados.
- `tests/fixtures/e2e-data.ts` — sumar 1-2 `PermissionGroup`
  baseline + 1 `GroupMembership` baseline (G.8).
- `tests/fixtures/e2e-seed.ts` — wipe + create.

## Helpers / patterns reusados (no duplicar)

- `findPlaceOwnership(userId, placeId)` (`@/shared/lib/identity-cache`)
  — owner gate y owner-bypass en hasPermission.
- `findMemberPermissions(userId, placeId)` — refactor a la nueva
  API basada en grupos (deprecar `role`).
- Patrón **discriminated union return** para errores esperados.
  Tabla completa (audit-fixed 2026-05-02 — exhaustiva por action):

  | Action                        | `error` discriminator                                                                  |
  | ----------------------------- | -------------------------------------------------------------------------------------- |
  | `createGroupAction`           | `group_name_taken`, `permission_invalid`                                               |
  | `updateGroupAction`           | `group_name_taken`, `permission_invalid`, `cannot_modify_preset`                       |
  | `deleteGroupAction`           | `group_has_members`, `cannot_delete_preset`                                            |
  | `addMemberToGroupAction`      | `target_user_not_member`, `target_is_owner`, `already_in_group`                        |
  | `removeMemberFromGroupAction` | `not_in_group`                                                                         |
  | `setGroupCategoryScopeAction` | `category_not_in_place`, `cannot_scope_preset`                                         |
  | `blockMemberAction`           | `cannot_block_owner`, `cannot_block_self`, `already_blocked`, `target_user_not_member` |
  | `unblockMemberAction`         | `not_blocked`                                                                          |
  | `expelMemberAction`           | `cannot_expel_owner`, `cannot_expel_self`, `target_user_not_member`                    |

  Errores **inesperados** (auth, NotFoundError de place, validation
  Zod corrupta) siguen como throw — caen al `error.tsx` boundary.

- Patrón snapshot para erasure 365d: `Membership.blockedByUserId`
  y `expelledByUserId` nullable + SetNull. NO sumar
  `blockedBySnapshot` v1 — rara vez consultable post-erasure;
  evaluar en plan futuro si aparece necesidad.
- Patrón mailer Resend (`shared/lib/mailer`). Templates nuevos
  siguen el shape de `members/server/mailer/invitation-email.ts`.
- Patrón de form dialog con `useTransition` + pending state
  (`tier-form-dialog.tsx`).
- Patrón de UI con DialogTrigger asChild (gotcha M.6 — sin
  controlled state si no es necesario).
- Patrón de E2E con worker isolation
  (`tests/e2e/flows/members-directory.spec.ts`).

## Riesgos + mitigaciones

| Riesgo                                                                                         | Severity | Mitigación                                                                                                                                                                                                                                        |
| ---------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Refactor masivo de ~30 callsites rompe algo en producción                                      | 🔴       | Strategy de coexistencia (G.1.5 fallback) permite migrar uno-a-uno con tests verde por cada paso. G.7 cleanup recién cuando 100% migrado.                                                                                                         |
| Migration data falla (admins no migran a grupo)                                                | 🔴       | Migration data con tx atómica. Test manual en cloud dev pre-deploy: contar admins existentes ↔ contar group memberships del preset post-migration deben coincidir.                                                                                |
| `hasPermission` performance: cada gate hace N queries (group memberships + scope)              | 🟠       | Cachear con `React.cache` en mismo request (patrón `findPlaceOwnership`). Para 150 miembros × 5-10 grupos × 10 permisos, el query es indexado y rápido. Si emerge bottleneck, sumar denormalización.                                              |
| `listAllowedCategoryIds` para library scope: query extra por cada page de library              | 🟠       | Cacheado igualmente. Index en `GroupCategoryScope(groupId, categoryId)` cubre el join.                                                                                                                                                            |
| Email Resend de block/expel falla (Resend caído / dominio no verificado)                       | 🟡       | Try/catch en la action: si falla el email, la acción de bloqueo/expulsión SÍ se commitea (es la intención principal); el email queda como log warning. UI muestra toast "Acción ejecutada pero el email no pudo enviarse — contactá manualmente." |
| Owner se intenta bloquear/expulsar a sí mismo                                                  | 🟡       | Gate explícito en actions: `if (memberUserId === actorId) throw ...`. UI no muestra los botones cuando viewer es target.                                                                                                                          |
| Owner se intenta bloquear/expulsar a otro owner                                                | 🟡       | Gate: `findPlaceOwnership(memberUserId)` chequea — si target es owner, return `{ ok: false, error: 'cannot_block_owner' }`.                                                                                                                       |
| Block dura indefinidamente (sin timeout)                                                       | 🟢       | Aceptado v1. Si producto pide "bloqueo temporal de N días" se suma `blockedUntil DateTime?` campo aparte.                                                                                                                                         |
| User bloqueado bookmarkea page interna y entra                                                 | 🟡       | Gate `(gated)/layout.tsx` chequea blockedAt en cada request. Layout cubre TODAS las pages bajo `(gated)/`.                                                                                                                                        |
| User bloqueado intenta entrar a `/settings/access` para "salir manualmente"                    | 🟡       | `/settings/access` está fuera de `(gated)/` (settings sigue accesible para admin/owner config). Para user bloqueado: `/settings/layout.tsx` chequea blockedAt → 404.                                                                              |
| Refactor de role en tests E2E rompe específicos                                                | 🟠       | E2E spec de tier-memberships y tiers usan storage states pre-baked con cookies — el refactor de role NO debería afectar. Audit pre-G.7 del E2E suite.                                                                                             |
| Grupo "Administradores" preset en places existentes (data migration) puede fallar parcialmente | 🟠       | Migration en tx por place. Si falla un place, retry idempotente (chequea si ya existe el grupo antes de crear).                                                                                                                                   |

## Alineación con CLAUDE.md y architecture.md

- ✅ **Vertical slices**: nuevo slice `groups/` autocontenido. Imports
  cross-slice solo de `members/public(.server)` y `tiers/public(.server)`
  (estos últimos para inferir nombres en UI). Unidirección.
- ✅ **Spec antes de código**: G.0 entrega spec + ADR antes de G.1.
- ✅ **TDD**: cada sub-fase con tests primero.
- ⚠️ **Caps de tamaño**: cada archivo del slice estimado < 300 LOC.
  Slice total **estimado realista por audit ~1600 LOC** (excede el
  cap default de 1500 en ~100). Plan: agente A en G.2 audita LOC
  parcial al cerrar — si supera 1500, decisión:
  1. **Split a 2 slices**: `groups/` (domain + queries + actions) +
     `groups-ui/` (UI components). Boundary check actualizado.
  2. **ADR de excepción** documentado en
     `docs/decisions/2026-05-XX-groups-size-exception.md` (mismo
     patrón que `discussions` ADR de excepción).
     Decisión por agente A según el growth real. Pre-aprobada
     cualquiera de las dos.
- ✅ **Sin libertad arquitectónica**: respeto a las decisiones cerradas
  por user (10 permisos, eliminar admin, owner-dios, hard-delete con
  pre-condición, scope library por categoría, block/expel email).
- ✅ **Idioma**: comments + UI labels en español, código en inglés.
- ✅ **Validación Zod**: cada server action parsea input con schema +
  valida que `permissions[]` sean del enum hardcoded.
- ✅ **Tipos estrictos**: sin `any`. Permission enum exhaustivo.
  Discriminated unions explícitos.
- ✅ **Server Components default**: list, detail, page son RSC.
  Solo dialogs y form controls son Client islands.
- ✅ **Tailwind solo layout/spacing**.
- ✅ **Owner-only doble gate (v1)**: server action +
  `findPlaceOwnership` + UI gate `perms.isOwner` para acciones
  hardcoded. Permisos atómicos: `hasPermission` server-side + UI
  filtra acciones según permisos del viewer.
- ✅ **Discriminated union return** para errores esperados
  (gotcha CLAUDE.md 2026-05-02).
- ✅ **Connection_limit gotcha**: `hasPermission` cacheado con
  `React.cache`. Tests verifican que query es 1-2 max por request.
- ✅ **Sin métricas vanidosas** (CLAUDE.md): el directorio de grupos
  NO muestra "grupo más activo" ni "miembros más bloqueados".
- ✅ **Identidad contextual**: emails de block/expel sólo se envían
  al miembro afectado. NO se cuelan en otras pages.

## Verificación

### Por sub-fase

- typecheck + lint + tests targeted al slice/área modificado.

### Cuando G.8 cierre (final)

- typecheck + lint + suite completa (Vitest + E2E). RLS suite no
  aplica (deferida).
- Build prod limpio.
- Migration `<ts>_drop_membership_role` aplicada al cloud dev. La
  columna ya no existe.
- Manual smoke en dev local:
  1. Owner entra a `/settings/groups` → ve grupo preset
     "Administradores" + miembros existentes (admins migrados).
  2. Owner crea grupo nuevo "Moderadores" con permisos
     `discussions:hide-post` + `flags:review`. Asigna a memberA.
  3. memberA entra al place, va a una discussion → puede ocultar
     posts (botón visible). Va a la lista de flags → puede revisar.
     Va a settings → no ve `Tiers` ni `Groups` ni `Members`
     directorio (no es owner).
  4. Owner crea grupo "Library Mods" con permiso
     `library:moderate-categories` + scope a categoría "Recetas"
     solo. Asigna a memberB.
  5. memberB en `/library/recetas` → puede archivar items + editar
     la categoría. En `/library/tutoriales` → no ve los controles
     (scope no incluye esa categoría).
  6. Owner intenta eliminar el grupo "Moderadores" con miembros
     dentro → toast "Quitá los miembros primero".
  7. Owner quita memberA de "Moderadores" → puede eliminar el grupo.
  8. Owner intenta eliminar el grupo preset "Administradores" → no
     aparece el botón delete (UI lo oculta + server action lo
     bloquea).
  9. memberC (con permiso `members:block` vía un grupo) entra al
     detalle de memberD → ve botón "Bloquear miembro". Click →
     modal con motivo "Spam reiterado" + email autocompletado.
     Confirm. memberD recibe email Resend.
  10. memberD intenta entrar al place → ve `<UserBlockedView>` con
      "Estás bloqueado de [place]. Contactá a [email]".
  11. memberC desbloquea memberD → email "Tu acceso fue restaurado".
  12. memberD vuelve a entrar OK.
  13. Owner expulsa a memberD → modal con motivo + email. memberD
      recibe email final. memberD ya no es miembro (no puede
      re-entrar sin nueva invitación).
  14. memberC NO ve el botón "Expulsar" (permiso owner-only).
  15. Settings nav: owner ve `Groups` item. Members NO lo ven.
- E2E spec cubre 12+ escenarios:
  - Owner CRUD de grupo (crear/editar/eliminar con pre-condición).
  - Eliminación bloqueada de "Administradores" preset.
  - Asignar/remover miembro a grupo.
  - Scope library: usuario con scope ve controles solo en sus
    categorías designadas.
  - Permisos enforced: usuario sin permiso NO ve botón ni puede
    ejecutar acción (intento manual via fetch retorna error).
  - Block: dialog → email enviado → blocked user ve UserBlockedView.
  - Unblock: email enviado → user vuelve a tener acceso.
  - Expel owner-only: members con permiso pero sin owner no ven el
    botón.
  - Owner intenta bloquearse a sí mismo → bloqueado.
  - Owner intenta bloquear/expulsar a otro owner → bloqueado.
  - Migration: tras G.1, contar `Membership.role === 'ADMIN'` ↔
    `GroupMembership` del preset. Deben matchear.
  - Settings nav: owner ve `Groups`, member no.

## Próximo paso

Si el plan se aprueba, arrancamos con **G.0**: spec + ADR. NO escribir
código en G.0.

G.1 produce el schema + migration aplicada al cloud dev + data
migration validada. G.1.5 los stubs compartidos para que G.2/G.3/G.4
puedan paralelizar inmediatamente.

**Riesgo principal a vigilar**: G.3 (refactor masivo) toca ~30
callsites. Cada uno se valida con tests propios. Si alguno se
escapa, el branch fallback de `hasPermission` (compat con
role===ADMIN) lo cubre hasta G.7. G.7 sólo cierra cuando 100%
migrado.
