-- Migración del feature TierMemberships (M.1).
--
-- Asigna tiers a miembros del place manualmente (owner-only en v1).
-- Sin Stripe — el campo `expiresAt` se persiste pero no se enforce v1.
-- Cron + paywall llegan en Fase 3 con Stripe Connect.
--
-- Plan + spec: docs/features/tier-memberships/spec.md.
-- ADR del modelo: docs/decisions/2026-05-02-tier-memberships-model.md.
-- Plan ejecutable: docs/plans/2026-05-02-tier-memberships-and-directory.md.

-- ---------------------------------------------------------------
-- 1. Index en User.displayName para `searchMembers`
-- ---------------------------------------------------------------

-- Sin este index, el `ILIKE '%query%'` de `searchMembers` hace full-table-scan.
-- Con 150 miembros × N places, escala mal. Index B-tree estándar es
-- suficiente para el patrón "case-insensitive prefix-or-substring search"
-- (Postgres usa el index para prefix matches `LOWER(displayName) ILIKE 'q%'`).
-- Para búsqueda por trigrama futura (>1000 miembros por place), evaluar
-- pg_trgm en plan posterior.
CREATE INDEX "User_displayName_idx" ON "User"("displayName");

-- ---------------------------------------------------------------
-- 2. Tabla TierMembership
-- ---------------------------------------------------------------

-- Cardinalidad N: un user puede tener N tiers asignados simultáneamente
-- (e.g., free "Colaboradores" + "Premium" pago). El UNIQUE de abajo previene
-- duplicados del MISMO tier para el MISMO user.
--
-- Audit log preservado vía snapshot pattern (mismo de Post/Comment/Flag/Event):
-- `assignedByUserId` nullable + `onDelete: SetNull` + `assignedBySnapshot JSONB`
-- congelado al momento de asignar. Sobrevive aunque el assigner pase por
-- erasure 365d. Ver docs/decisions/2026-04-24-erasure-365d.md.
--
-- `expiresAt` nullable: NULL = asignación indefinida (vive hasta que owner
-- remueva). Si presente, calculado de `assignedAt + tierDurationToDays(tier.duration)`
-- por la server action al asignar. v1 sólo lo guarda informativo.
--
-- `updatedAt`: defensive future-proofing. Stripe Fase 3 lo usará para trackear
-- renovaciones (extend expiration). Costo cero hoy.
CREATE TABLE "TierMembership" (
  "id"                 TEXT          NOT NULL,
  "tierId"             TEXT          NOT NULL,
  "userId"             TEXT          NOT NULL,
  "placeId"            TEXT          NOT NULL,
  "assignedAt"         TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "assignedByUserId"   TEXT,
  "assignedBySnapshot" JSONB         NOT NULL,
  "expiresAt"          TIMESTAMP(3),
  "updatedAt"          TIMESTAMP(3)  NOT NULL,

  CONSTRAINT "TierMembership_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------
-- 3. Indexes
-- ---------------------------------------------------------------

-- @@unique([tierId, userId]) — invariante de "no duplicados del mismo tier
-- en el mismo miembro". Permite cardinality N porque el unique es por par
-- (tier, user) — no por user solo.
CREATE UNIQUE INDEX "TierMembership_tierId_userId_key"
  ON "TierMembership"("tierId", "userId");

-- Listado por miembro en el directorio (`listAssignmentsByMember`).
CREATE INDEX "TierMembership_placeId_userId_idx"
  ON "TierMembership"("placeId", "userId");

-- Futuro: ranking de tier más asignado / `listAssignmentsByPlace` filtrado
-- por tierId.
CREATE INDEX "TierMembership_placeId_tierId_idx"
  ON "TierMembership"("placeId", "tierId");

-- Futuro: cron de expiración (Fase 3 con Stripe). Index sobre `expiresAt`
-- permite scan eficiente de `WHERE expiresAt < NOW() AND expiresAt IS NOT NULL`.
CREATE INDEX "TierMembership_expiresAt_idx"
  ON "TierMembership"("expiresAt");

-- ---------------------------------------------------------------
-- 4. Foreign Keys
-- ---------------------------------------------------------------

-- onDelete: Restrict — previene borrar un Tier con asignaciones vivas.
-- Forzará en futuro (cuando exista hard-delete de tier) que el owner remueva
-- las asignaciones primero. Hoy v1 sólo soporta soft via visibility=HIDDEN,
-- así que no hay riesgo inmediato.
ALTER TABLE "TierMembership"
  ADD CONSTRAINT "TierMembership_tierId_fkey"
  FOREIGN KEY ("tierId") REFERENCES "Tier"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- onDelete: Cascade — si el user se hard-deletea (futuro erasure completo),
-- las asignaciones se cleanup automáticamente. Coherente con el resto del
-- schema (Membership, PostRead, etc. también cascadean por userId).
ALTER TABLE "TierMembership"
  ADD CONSTRAINT "TierMembership_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- onDelete: Cascade — si el place se borra (caso erasure de place futuro),
-- las asignaciones se cleanup. Coherente con Tier/Membership/etc.
ALTER TABLE "TierMembership"
  ADD CONSTRAINT "TierMembership_placeId_fkey"
  FOREIGN KEY ("placeId") REFERENCES "Place"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- onDelete: SetNull — si el assigner se hard-deletea, el row del
-- TierMembership sobrevive (con `assignedByUserId = NULL`). El snapshot
-- `assignedBySnapshot` preserva el dato histórico (displayName, avatar
-- al momento de asignar). Esto preserva el audit log incluso después de
-- erasure 365d del owner que asignó.
ALTER TABLE "TierMembership"
  ADD CONSTRAINT "TierMembership_assignedByUserId_fkey"
  FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
