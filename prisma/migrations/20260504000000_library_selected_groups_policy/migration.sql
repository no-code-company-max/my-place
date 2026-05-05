-- M1 — Migration aditiva del rediseño de contribution policy.
--
-- Decisión: docs/decisions/2026-05-04-library-contribution-policy-groups.md
--
-- Cambios:
-- 1. Agrega `SELECTED_GROUPS` al enum `ContributionPolicy` (additive — no
--    rompe nada porque ningún código lo escribe todavía; F.3 expone la UI).
-- 2. Cambia el default de la columna `LibraryCategory.contributionPolicy`
--    de `ADMIN_ONLY` a `MEMBERS_OPEN` (alineado con principio "calmo y
--    abierto" del producto post-cleanup; el viejo default ya no existe a
--    nivel app desde 2026-05-04).
--
-- `ADMIN_ONLY` SE MANTIENE en el enum hasta F.4 (M2): Postgres no soporta
-- DROP VALUE directo y debemos garantizar que ninguna fila lo use al momento
-- del drop. M1 deploya antes que M2 → window seguro de rollback sin restore.

ALTER TYPE "ContributionPolicy" ADD VALUE IF NOT EXISTS 'SELECTED_GROUPS';

ALTER TABLE "LibraryCategory"
  ALTER COLUMN "contributionPolicy" SET DEFAULT 'MEMBERS_OPEN';
