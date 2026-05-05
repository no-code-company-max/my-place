-- Refactor de `is_place_admin(place_id TEXT)` para derivar admin del grupo
-- preset "Administradores" en lugar de `Membership.role = 'ADMIN'`.
--
-- Backward-compat: la signature, return type, grants y SECURITY mode son
-- idénticos al original (`prisma/migrations/20260422000100_discussions_rls/`).
-- Las RLS policies que consumen este helper (discussions, events, library,
-- posts) NO requieren cambios.
--
-- Pre-requisito: la data migration `scripts/migrate-admins-to-groups.ts`
-- debe haber corrido en cada place ANTES de aplicar esta migration —
-- sino, los admins legacy (que sólo tienen role=ADMIN, sin GroupMembership
-- al preset) van a perder permisos. Verificado en G.0 plan
-- permission-groups y re-corrido al inicio de C.3 sobre cualquier ambiente
-- nuevo. Una vez aplicada la migration 20260503000100_drop_membership_role,
-- el script ya no es necesario y se elimina.
--
-- Plan: /Users/maxi/.claude/plans/tidy-stargazing-summit.md § C.3
-- ADR:  docs/decisions/2026-05-03-drop-membership-role-rls-impact.md

CREATE OR REPLACE FUNCTION public.is_place_admin(place_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM "GroupMembership" gm
    JOIN "PermissionGroup" g ON g."id" = gm."groupId"
    WHERE gm."placeId" = place_id
      AND gm."userId" = auth.uid()::text
      AND g."isPreset" = true
      AND g."placeId" = place_id
  ) OR EXISTS (
    SELECT 1
    FROM "PlaceOwnership" o
    WHERE o."placeId" = place_id
      AND o."userId" = auth.uid()::text
  );
$$;
