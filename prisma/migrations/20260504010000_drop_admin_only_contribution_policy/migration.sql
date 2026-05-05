-- M2 — Cleanup: drop `ADMIN_ONLY` del enum `ContributionPolicy`.
--
-- Decisión: docs/decisions/2026-05-04-library-contribution-policy-groups.md
--
-- Postgres no soporta `ALTER TYPE ... DROP VALUE` directo. Patrón canónico:
--   1. UPDATE filas existentes con ADMIN_ONLY → MEMBERS_OPEN (decisión #A
--      ADR: las pocas filas existentes se migran a MEMBERS_OPEN, default
--      "calmo y abierto" del producto; ningún owner había configurado
--      ADMIN_ONLY con intent de "restringido sin contributors", entonces
--      MEMBERS_OPEN es el reemplazo más seguro).
--   2. Assertion defensiva — si quedó alguna fila tras el UPDATE, abortar
--      con error explícito (señal de bug en step 1, o de race condition
--      con un INSERT mientras la migration corre).
--   3. CREATE TYPE _new sin el valor.
--   4. ALTER COLUMN ... USING para castear filas al nuevo tipo.
--   5. DROP TYPE viejo + RENAME _new al nombre canónico.
--   6. Restaurar default a `MEMBERS_OPEN` (el ALTER COLUMN TYPE pierde el
--      default — hay que re-setearlo).
--
-- Pre-requisitos:
--   - F.2 (M1) ya corrió → el enum tiene SELECTED_GROUPS.
--   - F.1+F.2+F.3 deployados → app no escribe ADMIN_ONLY (Zod rechaza,
--     UI no expone, narrowing trata `ADMIN_ONLY` como `MEMBERS_OPEN` en
--     reads defensivos).
--   - Seed E2E ya migrado a DESIGNATED (F.2 update de e2e-data.ts).

-- Step 1: data migration trivial (idempotente — corre 0 vez en envs limpios).
UPDATE "LibraryCategory"
SET "contributionPolicy" = 'MEMBERS_OPEN'
WHERE "contributionPolicy" = 'ADMIN_ONLY';

-- Step 2: defensa en profundidad. El UPDATE de step 1 debería haber
-- dejado 0 filas con ADMIN_ONLY. Si no, abortamos con error explícito
-- antes del DDL destructivo.
DO $$
DECLARE
  bad_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO bad_count
  FROM "LibraryCategory"
  WHERE "contributionPolicy" = 'ADMIN_ONLY';

  IF bad_count > 0 THEN
    RAISE EXCEPTION 'Migration abortada: % fila(s) en LibraryCategory todavía usan contributionPolicy=ADMIN_ONLY tras el UPDATE. Investigar (race con INSERT concurrente?).', bad_count;
  END IF;
END $$;

-- Step 3: drop la RLS policy `LibraryItem_insert_with_policy` que
-- referencia `LibraryCategory.contributionPolicy` por nombre. Sin esto,
-- Postgres rechaza el ALTER COLUMN TYPE con
-- "cannot alter type of a column used in a policy definition".
--
-- Decisión 2026-05-04: NO se re-crea la policy. La autorización de
-- "quién puede crear items" pasa 100% al app-layer (`canCreateInCategory`
-- + check en `createLibraryItemAction`). Cuando se haga la fase RLS
-- general posterior, se redefinen las policies para library coherentes
-- con las 3 policies activas (DESIGNATED, MEMBERS_OPEN, SELECTED_GROUPS).
-- Ver ADR `docs/decisions/2026-05-04-library-contribution-policy-groups.md`
-- § "Decisión #9 RLS deferida".
DROP POLICY IF EXISTS "LibraryItem_insert_with_policy" ON "LibraryItem";

-- Steps 4-7: recrear el enum sin ADMIN_ONLY.
CREATE TYPE "ContributionPolicy_new" AS ENUM ('DESIGNATED', 'MEMBERS_OPEN', 'SELECTED_GROUPS');

ALTER TABLE "LibraryCategory"
  ALTER COLUMN "contributionPolicy" DROP DEFAULT;

ALTER TABLE "LibraryCategory"
  ALTER COLUMN "contributionPolicy"
    TYPE "ContributionPolicy_new"
    USING ("contributionPolicy"::text::"ContributionPolicy_new");

DROP TYPE "ContributionPolicy";

ALTER TYPE "ContributionPolicy_new" RENAME TO "ContributionPolicy";

ALTER TABLE "LibraryCategory"
  ALTER COLUMN "contributionPolicy" SET DEFAULT 'MEMBERS_OPEN';
