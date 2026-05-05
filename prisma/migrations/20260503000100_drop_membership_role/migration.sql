-- Drop `Membership.role` column + `MembershipRole` enum.
--
-- La columna ya no es leída por código de aplicación (refactor cerrado en
-- C.2 + C.3 del plan tidy-stargazing-summit). El SQL helper `is_place_admin`
-- ya fue refactoreado en migration 20260503000000_redefine_is_place_admin_via_groups
-- para derivar de `GroupMembership` al preset, así que dropear la columna
-- no rompe RLS.
--
-- IRREVERSIBLE: una vez dropeada, los datos del rol original se pierden.
-- En prod, el deploy A debe estar estable >24h antes del deploy B
-- (que aplica esta migration). Snapshot manual via Supabase PITR antes.
--
-- Plan: /Users/maxi/.claude/plans/tidy-stargazing-summit.md § C.3
-- ADR:  docs/decisions/2026-05-03-drop-membership-role-rls-impact.md

ALTER TABLE "Membership" DROP COLUMN "role";
DROP TYPE "MembershipRole";
