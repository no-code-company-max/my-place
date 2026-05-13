-- S1b — Drop legacy del modelo de contribution (single migration).
--
-- ADR: docs/decisions/2026-05-12-library-permissions-model.md
-- Plan: docs/plans/2026-05-12-library-permissions-redesign.md
--
-- Cambios:
-- 1. Drop policy `LibraryItem_insert_with_policy` (usa contributionPolicy).
-- 2. Drop tabla `LibraryCategoryContributor` (drop cascading policies).
-- 3. Drop tabla `GroupCategoryScope` (idem).
-- 4. Drop column `LibraryCategory.contributionPolicy`.
-- 5. Drop enum `ContributionPolicy`.
-- 6. NEW helper SQL `is_place_owner(place_id)` — bypass owner para RLS.
-- 7. NEW policy `LibraryItem_insert_with_write_access` que replica
--    `canWriteCategory` del sub-slice `library/contribution`:
--    is_place_owner → bypass; sino matchea write scope según
--    writeAccessKind (GROUPS|TIERS|USERS).
--
-- Las tablas write scope creadas en S1a (20260512000000) siguen sin RLS
-- — consistente con las read scope (deferido). El gate efectivo de
-- escritura vive en `LibraryItem.INSERT`.
--
-- Las categorías existentes en dev conservan `writeAccessKind = 'OWNER_ONLY'`
-- (default seteado en S1a). El owner debe ampliar el scope explícitamente
-- vía `setLibraryCategoryWriteScopeAction`.

-- ────────────────────────────────────────────────────────────────────────
-- Step 1: drop policy vieja que referencia contributionPolicy
-- ────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "LibraryItem_insert_with_policy" ON "LibraryItem";

-- ────────────────────────────────────────────────────────────────────────
-- Step 2: drop LibraryCategoryContributor (cascade drop de policies)
-- ────────────────────────────────────────────────────────────────────────

DROP TABLE IF EXISTS "LibraryCategoryContributor" CASCADE;

-- ────────────────────────────────────────────────────────────────────────
-- Step 3: drop GroupCategoryScope (no RLS pero borrar de todos modos)
-- ────────────────────────────────────────────────────────────────────────

DROP TABLE IF EXISTS "GroupCategoryScope" CASCADE;

-- ────────────────────────────────────────────────────────────────────────
-- Step 4 + 5: drop columna contributionPolicy + enum
-- ────────────────────────────────────────────────────────────────────────

ALTER TABLE "LibraryCategory" DROP COLUMN "contributionPolicy";

DROP TYPE "ContributionPolicy";

-- ────────────────────────────────────────────────────────────────────────
-- Step 6: helper SQL is_place_owner(place_id)
-- ────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_place_owner(place_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM "PlaceOwnership" o
    WHERE o."placeId" = place_id
      AND o."userId" = auth.uid()::text
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_place_owner(TEXT) TO authenticated, anon;

-- ────────────────────────────────────────────────────────────────────────
-- Step 7: nueva policy de INSERT que replica canWriteCategory
-- ────────────────────────────────────────────────────────────────────────
-- Reglas (idénticas a `canWriteCategory` del sub-slice contribution):
--   - Owner del place: siempre bypass.
--   - writeAccessKind=OWNER_ONLY: nadie excepto owner (cae al bypass arriba).
--   - writeAccessKind=GROUPS: viewer en GroupMembership de algún grupo del scope.
--   - writeAccessKind=TIERS: viewer en TierMembership activa de algún tier del scope.
--   - writeAccessKind=USERS: viewer en LibraryCategoryUserWriteScope.
--
-- También exigimos `authorUserId = auth.uid()` (un member no puede crear
-- un item "en nombre" de otro), y la categoría debe estar activa.

CREATE POLICY "LibraryItem_insert_with_write_access" ON "LibraryItem"
  FOR INSERT
  WITH CHECK (
    public.is_active_member("placeId")
    AND "authorUserId" = auth.uid()::text
    AND (
      public.is_place_owner("placeId")
      OR EXISTS (
        SELECT 1 FROM "LibraryCategory" c
        WHERE c."id" = "LibraryItem"."categoryId"
          AND c."placeId" = "LibraryItem"."placeId"
          AND c."archivedAt" IS NULL
          AND (
            (
              c."writeAccessKind" = 'GROUPS'
              AND EXISTS (
                SELECT 1 FROM "LibraryCategoryGroupWriteScope" ws
                INNER JOIN "GroupMembership" gm ON gm."groupId" = ws."groupId"
                WHERE ws."categoryId" = c."id"
                  AND gm."userId" = auth.uid()::text
                  AND gm."placeId" = c."placeId"
              )
            )
            OR (
              c."writeAccessKind" = 'TIERS'
              AND EXISTS (
                SELECT 1 FROM "LibraryCategoryTierWriteScope" ws
                INNER JOIN "TierMembership" tm ON tm."tierId" = ws."tierId"
                WHERE ws."categoryId" = c."id"
                  AND tm."userId" = auth.uid()::text
                  AND tm."placeId" = c."placeId"
                  AND (tm."expiresAt" IS NULL OR tm."expiresAt" > NOW())
              )
            )
            OR (
              c."writeAccessKind" = 'USERS'
              AND EXISTS (
                SELECT 1 FROM "LibraryCategoryUserWriteScope" ws
                WHERE ws."categoryId" = c."id"
                  AND ws."userId" = auth.uid()::text
              )
            )
          )
      )
    )
  );
