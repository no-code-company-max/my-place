-- Slice `events` (F.B de Fase 6): agregar EVENT al enum ContentTargetKind.
-- Ver docs/features/events/spec-integrations.md § 4 (PR-2).
--
-- Razón del split en migración separada del CREATE TABLE Event:
--   Postgres restringe `ALTER TYPE ... ADD VALUE` a ejecutarse fuera de
--   transaction. Prisma migrate envuelve cada migration `.sql` en una sola
--   tx implícita. Si esto se ejecuta junto con CREATE TABLE Event en el
--   mismo archivo, Postgres dispara:
--     ERROR: ALTER TYPE ... ADD cannot run inside a transaction block
--   Solución estándar: 2 migrations consecutivas (la de schema + esta).
--
-- Efecto: Reaction y Flag (definidos en 20260422000000_discussions_core)
-- pasan a aceptar `targetType = 'EVENT'`. Los handlers en flags/server/
-- queries.ts y discussions/server/reactions-aggregation.ts se actualizan
-- en F.C (PR-2 del plan tidy-stargazing-summit).
--
-- F1: sólo flags consume EVENT (eventos reportables). Reactions sobre
-- eventos quedan diferidas — el enum lo admite pero la UI no lo expone.

ALTER TYPE "ContentTargetKind" ADD VALUE 'EVENT';
