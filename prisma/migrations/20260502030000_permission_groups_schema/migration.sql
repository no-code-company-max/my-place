-- Migración del feature PermissionGroups + Block/Expel (G.1).
--
-- Sistema de grupos con permisos atómicos delegables. Reemplaza el rol
-- ADMIN del enum MembershipRole por un grupo preset "Administradores"
-- auto-generado. Suma block/unblock (delegable vía permiso members:block)
-- y expel (owner-only hardcoded).
--
-- IMPORTANTE: este migration es DDL puro. La data migration que crea el
-- grupo preset y migra admins existentes vive en `scripts/migrate-admins-to-groups.ts`.
-- Validación post-migration en `scripts/validate-admins-migration.ts`.
--
-- Plan + spec: docs/features/groups/spec.md.
-- ADR del modelo: docs/decisions/2026-05-02-permission-groups-model.md.
-- Plan ejecutable: docs/plans/2026-05-02-permission-groups-and-member-controls.md.

-- ---------------------------------------------------------------
-- 1. Membership: extender con campos de block + expel.
-- ---------------------------------------------------------------

-- Block (delegable vía permiso members:block):
--   blockedAt           — soft-block timestamp. NULL = no bloqueado.
--   blockedByUserId     — quién bloqueó. SetNull si user borrado.
--   blockedReason       — motivo redactado por el admin (max 500).
--   blockedContactEmail — email del admin (autocompleta editable).
--                         Se muestra al user en <UserBlockedView>.
--
-- Expel (owner-only hardcoded):
--   leftAt se setea por el flujo normal + estos campos:
--   expelledByUserId  — IS NOT NULL distingue expel de leave voluntario.
--   expelReason       — motivo redactado.
--   expelContactEmail — email del owner (autocompleta editable).
ALTER TABLE "Membership"
  ADD COLUMN "blockedAt"           TIMESTAMP(3),
  ADD COLUMN "blockedByUserId"     TEXT,
  ADD COLUMN "blockedReason"       VARCHAR(500),
  ADD COLUMN "blockedContactEmail" TEXT,
  ADD COLUMN "expelledByUserId"    TEXT,
  ADD COLUMN "expelReason"         VARCHAR(500),
  ADD COLUMN "expelContactEmail"   TEXT;

-- onDelete: SetNull en blockedBy/expelledBy: si el user que bloqueó/expulsó
-- pasa por erasure 365d, el row de Membership sobrevive (perdemos el FK
-- pero conservamos motivo + contactEmail).
ALTER TABLE "Membership"
  ADD CONSTRAINT "Membership_blockedByUserId_fkey"
  FOREIGN KEY ("blockedByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Membership"
  ADD CONSTRAINT "Membership_expelledByUserId_fkey"
  FOREIGN KEY ("expelledByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------
-- 2. PermissionGroup: grupos custom con lista de permisos atómicos.
-- ---------------------------------------------------------------

-- permissions: Postgres array (text[]) de permisos atómicos. Validados
-- en server actions (Zod) contra el enum hardcoded `Permission`. Pragmático
-- para 10 permisos estables; si crece > 30, normalizar a tabla
-- GroupPermission(groupId, permission).
--
-- isPreset: hardcoded "Administradores" tiene isPreset=true. NO se puede
-- eliminar (server action bloquea). NO se pueden modificar permisos del
-- preset. Sí se gestionan miembros + name/description.
CREATE TABLE "PermissionGroup" (
  "id"          TEXT         NOT NULL,
  "placeId"     TEXT         NOT NULL,
  "name"        VARCHAR(60)  NOT NULL,
  "description" VARCHAR(280),
  "permissions" TEXT[]       NOT NULL DEFAULT ARRAY[]::TEXT[],
  "isPreset"    BOOLEAN      NOT NULL DEFAULT false,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PermissionGroup_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PermissionGroup_placeId_idx" ON "PermissionGroup"("placeId");

-- onDelete CASCADE: si el place se hard-deletea (futuro erasure de place),
-- los grupos se cleanup. Coherente con Tier/Membership.
ALTER TABLE "PermissionGroup"
  ADD CONSTRAINT "PermissionGroup_placeId_fkey"
  FOREIGN KEY ("placeId") REFERENCES "Place"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------
-- 3. GroupMembership: asignación N:M de User a PermissionGroup.
-- ---------------------------------------------------------------

-- placeId denormalizado: las queries hot path (`hasPermission(userId, placeId)`)
-- filtran por placeId sin necesidad de join a PermissionGroup. Index compuesto
-- (placeId, userId) cubre el patrón.
--
-- addedByUserId nullable + SetNull: si el user que asignó pasa por erasure
-- 365d, el row sobrevive. Audit info parcial pero la membership sigue.
CREATE TABLE "GroupMembership" (
  "id"            TEXT         NOT NULL,
  "groupId"       TEXT         NOT NULL,
  "userId"        TEXT         NOT NULL,
  "placeId"       TEXT         NOT NULL,
  "addedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "addedByUserId" TEXT,

  CONSTRAINT "GroupMembership_pkey" PRIMARY KEY ("id")
);

-- @@unique([groupId, userId]): un user no puede estar 2 veces en el mismo
-- grupo (idempotencia + dedup).
CREATE UNIQUE INDEX "GroupMembership_groupId_userId_key"
  ON "GroupMembership"("groupId", "userId");

-- Hot path: hasPermission filtra por (placeId, userId).
CREATE INDEX "GroupMembership_placeId_userId_idx"
  ON "GroupMembership"("placeId", "userId");

-- Cross-place: "todos los grupos del user X en cualquier place".
CREATE INDEX "GroupMembership_userId_idx"
  ON "GroupMembership"("userId");

-- onDelete CASCADE en groupId/userId/placeId: cleanup automático.
-- onDelete SetNull en addedByUserId: erasure preserva el row.
ALTER TABLE "GroupMembership"
  ADD CONSTRAINT "GroupMembership_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "PermissionGroup"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GroupMembership"
  ADD CONSTRAINT "GroupMembership_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GroupMembership"
  ADD CONSTRAINT "GroupMembership_placeId_fkey"
  FOREIGN KEY ("placeId") REFERENCES "Place"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GroupMembership"
  ADD CONSTRAINT "GroupMembership_addedByUserId_fkey"
  FOREIGN KEY ("addedByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------
-- 4. GroupCategoryScope: scope library:* de un grupo a categorías específicas.
-- ---------------------------------------------------------------

-- Si un grupo tiene entries acá → permisos library:* aplican SOLO a esas
-- categorías. Sin entries → global (todas las categorías del place).
--
-- Hardcoded: el grupo preset "Administradores" NO puede tener entries
-- (server action bloquea con cannot_scope_preset). El preset es global
-- por diseño.
CREATE TABLE "GroupCategoryScope" (
  "groupId"    TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,

  CONSTRAINT "GroupCategoryScope_pkey" PRIMARY KEY ("groupId", "categoryId")
);

-- Index para query "qué grupos están scoped a esta categoría" (cleanup
-- al archivar categoría, debug).
CREATE INDEX "GroupCategoryScope_categoryId_idx"
  ON "GroupCategoryScope"("categoryId");

-- onDelete CASCADE en ambos: si se borra el grupo o la categoría, scope se
-- cleanup automáticamente.
ALTER TABLE "GroupCategoryScope"
  ADD CONSTRAINT "GroupCategoryScope_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "PermissionGroup"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GroupCategoryScope"
  ADD CONSTRAINT "GroupCategoryScope_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "LibraryCategory"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
