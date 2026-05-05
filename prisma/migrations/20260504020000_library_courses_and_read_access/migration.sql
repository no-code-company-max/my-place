-- G.1 — Library courses + read access foundation (additive single migration).
--
-- ADR: docs/decisions/2026-05-04-library-courses-and-read-access.md
-- Plan: docs/plans/2026-05-04-library-courses-and-read-access.md
--
-- Cambios:
-- 1. Enum `LibraryCategoryKind` (GENERAL, COURSE) + columna
--    `LibraryCategory.kind` con default GENERAL.
-- 2. Enum `LibraryReadAccessKind` (PUBLIC, GROUPS, TIERS, USERS) + columna
--    `LibraryCategory.readAccessKind` con default PUBLIC.
-- 3. Columna `LibraryItem.prereqItemId` (self-FK, ON DELETE SET NULL).
-- 4. Tabla `LibraryItemCompletion` (PK compuesto + índice por user).
-- 5. Tablas `LibraryCategoryGroupReadScope`, `LibraryCategoryTierReadScope`,
--    `LibraryCategoryUserReadScope` (PK compuesto, FK ON DELETE CASCADE).
--
-- TODO RLS futura: las nuevas tablas se crean SIN policies (consistente
-- con sesión 2026-05-04 — RLS deferida). La fase RLS general posterior
-- cubrirá library + courses + access en una sola migration.

-- ────────────────────────────────────────────────────────────────────────
-- Step 1: enums nuevos
-- ────────────────────────────────────────────────────────────────────────

CREATE TYPE "LibraryCategoryKind" AS ENUM ('GENERAL', 'COURSE');

CREATE TYPE "LibraryReadAccessKind" AS ENUM ('PUBLIC', 'GROUPS', 'TIERS', 'USERS');

-- ────────────────────────────────────────────────────────────────────────
-- Step 2: columnas nuevas en LibraryCategory
-- ────────────────────────────────────────────────────────────────────────

ALTER TABLE "LibraryCategory"
  ADD COLUMN "kind" "LibraryCategoryKind" NOT NULL DEFAULT 'GENERAL',
  ADD COLUMN "readAccessKind" "LibraryReadAccessKind" NOT NULL DEFAULT 'PUBLIC';

-- ────────────────────────────────────────────────────────────────────────
-- Step 3: columna prereqItemId en LibraryItem (self-FK)
-- ────────────────────────────────────────────────────────────────────────

ALTER TABLE "LibraryItem"
  ADD COLUMN "prereqItemId" TEXT;

ALTER TABLE "LibraryItem"
  ADD CONSTRAINT "LibraryItem_prereqItemId_fkey"
    FOREIGN KEY ("prereqItemId")
    REFERENCES "LibraryItem"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;

CREATE INDEX "LibraryItem_prereqItemId_idx" ON "LibraryItem"("prereqItemId");

-- ────────────────────────────────────────────────────────────────────────
-- Step 4: tabla LibraryItemCompletion
-- ────────────────────────────────────────────────────────────────────────

CREATE TABLE "LibraryItemCompletion" (
  "itemId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LibraryItemCompletion_pkey" PRIMARY KEY ("itemId", "userId")
);

CREATE INDEX "LibraryItemCompletion_userId_idx" ON "LibraryItemCompletion"("userId");

ALTER TABLE "LibraryItemCompletion"
  ADD CONSTRAINT "LibraryItemCompletion_itemId_fkey"
    FOREIGN KEY ("itemId")
    REFERENCES "LibraryItem"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;

ALTER TABLE "LibraryItemCompletion"
  ADD CONSTRAINT "LibraryItemCompletion_userId_fkey"
    FOREIGN KEY ("userId")
    REFERENCES "User"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;

-- ────────────────────────────────────────────────────────────────────────
-- Step 5: tabla LibraryCategoryGroupReadScope
-- ────────────────────────────────────────────────────────────────────────

CREATE TABLE "LibraryCategoryGroupReadScope" (
  "categoryId" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,

  CONSTRAINT "LibraryCategoryGroupReadScope_pkey" PRIMARY KEY ("categoryId", "groupId")
);

CREATE INDEX "LibraryCategoryGroupReadScope_groupId_idx" ON "LibraryCategoryGroupReadScope"("groupId");

ALTER TABLE "LibraryCategoryGroupReadScope"
  ADD CONSTRAINT "LibraryCategoryGroupReadScope_categoryId_fkey"
    FOREIGN KEY ("categoryId")
    REFERENCES "LibraryCategory"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;

ALTER TABLE "LibraryCategoryGroupReadScope"
  ADD CONSTRAINT "LibraryCategoryGroupReadScope_groupId_fkey"
    FOREIGN KEY ("groupId")
    REFERENCES "PermissionGroup"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;

-- ────────────────────────────────────────────────────────────────────────
-- Step 6: tabla LibraryCategoryTierReadScope
-- ────────────────────────────────────────────────────────────────────────

CREATE TABLE "LibraryCategoryTierReadScope" (
  "categoryId" TEXT NOT NULL,
  "tierId" TEXT NOT NULL,

  CONSTRAINT "LibraryCategoryTierReadScope_pkey" PRIMARY KEY ("categoryId", "tierId")
);

CREATE INDEX "LibraryCategoryTierReadScope_tierId_idx" ON "LibraryCategoryTierReadScope"("tierId");

ALTER TABLE "LibraryCategoryTierReadScope"
  ADD CONSTRAINT "LibraryCategoryTierReadScope_categoryId_fkey"
    FOREIGN KEY ("categoryId")
    REFERENCES "LibraryCategory"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;

ALTER TABLE "LibraryCategoryTierReadScope"
  ADD CONSTRAINT "LibraryCategoryTierReadScope_tierId_fkey"
    FOREIGN KEY ("tierId")
    REFERENCES "Tier"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;

-- ────────────────────────────────────────────────────────────────────────
-- Step 7: tabla LibraryCategoryUserReadScope
-- ────────────────────────────────────────────────────────────────────────

CREATE TABLE "LibraryCategoryUserReadScope" (
  "categoryId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,

  CONSTRAINT "LibraryCategoryUserReadScope_pkey" PRIMARY KEY ("categoryId", "userId")
);

CREATE INDEX "LibraryCategoryUserReadScope_userId_idx" ON "LibraryCategoryUserReadScope"("userId");

ALTER TABLE "LibraryCategoryUserReadScope"
  ADD CONSTRAINT "LibraryCategoryUserReadScope_categoryId_fkey"
    FOREIGN KEY ("categoryId")
    REFERENCES "LibraryCategory"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;

ALTER TABLE "LibraryCategoryUserReadScope"
  ADD CONSTRAINT "LibraryCategoryUserReadScope_userId_fkey"
    FOREIGN KEY ("userId")
    REFERENCES "User"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
