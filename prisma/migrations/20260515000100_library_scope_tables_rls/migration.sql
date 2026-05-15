-- Plan resync harness S3 — RLS de las 6 tablas scope de library.
--
-- Cierra la inconsistencia detectada en Fase 0
-- (`docs/plans/2026-05-15-rls-harness-library-resync.md`): las tablas
-- `LibraryCategory{Group,Tier,User}{Read,Write}Scope` se crearon
-- (20260512000000 / 20260513000000) sin `ENABLE ROW LEVEL SECURITY`,
-- mientras `LibraryCategory`/`LibraryItem` sí tienen RLS. Un
-- `authenticated` podía `SELECT` directo el mapa de "qué grupo/tier/
-- user accede a qué categoría" (metadata de configuración).
--
-- Estrategia (ADR 2026-05-15-rls-incremental-write-holistic-activate):
-- policy escrita + testeada ahora, SIN activar runtime (Prisma sigue
-- service-role; el switch holístico es paso aparte pre-launch).
--
-- Decisión G del plan: SELECT solo admin/owner del place de la
-- categoría (no member-transparent como lo era el difunto
-- `LibraryCategoryContributor`) — principio de menor exposición: es
-- config administrativa; ningún code-path de usuario la consume directo
-- (la app resuelve acceso server-side vía service-role, que bypassa
-- RLS). Sin policy INSERT/UPDATE/DELETE → deny-by-default para
-- `authenticated`; la app las gestiona vía service-role
-- (`setLibraryCategoryReadScopeAction` / `...WriteScopeAction`). Mismo
-- patrón que `ErasureAuditLog` (ADR 2026-05-01).
--
-- `is_place_admin` / `is_place_owner`: helpers SECURITY INVOKER ya
-- existentes (migraciones 20260503000000 / 20260513000000).

-- ── LibraryCategoryGroupReadScope ────────────────────────────────────
ALTER TABLE "LibraryCategoryGroupReadScope" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "LibraryCategoryGroupReadScope_select_admin"
  ON "LibraryCategoryGroupReadScope" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "LibraryCategory" c
      WHERE c."id" = "LibraryCategoryGroupReadScope"."categoryId"
        AND (public.is_place_admin(c."placeId") OR public.is_place_owner(c."placeId"))
    )
  );

-- ── LibraryCategoryTierReadScope ─────────────────────────────────────
ALTER TABLE "LibraryCategoryTierReadScope" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "LibraryCategoryTierReadScope_select_admin"
  ON "LibraryCategoryTierReadScope" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "LibraryCategory" c
      WHERE c."id" = "LibraryCategoryTierReadScope"."categoryId"
        AND (public.is_place_admin(c."placeId") OR public.is_place_owner(c."placeId"))
    )
  );

-- ── LibraryCategoryUserReadScope ─────────────────────────────────────
ALTER TABLE "LibraryCategoryUserReadScope" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "LibraryCategoryUserReadScope_select_admin"
  ON "LibraryCategoryUserReadScope" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "LibraryCategory" c
      WHERE c."id" = "LibraryCategoryUserReadScope"."categoryId"
        AND (public.is_place_admin(c."placeId") OR public.is_place_owner(c."placeId"))
    )
  );

-- ── LibraryCategoryGroupWriteScope ───────────────────────────────────
ALTER TABLE "LibraryCategoryGroupWriteScope" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "LibraryCategoryGroupWriteScope_select_admin"
  ON "LibraryCategoryGroupWriteScope" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "LibraryCategory" c
      WHERE c."id" = "LibraryCategoryGroupWriteScope"."categoryId"
        AND (public.is_place_admin(c."placeId") OR public.is_place_owner(c."placeId"))
    )
  );

-- ── LibraryCategoryTierWriteScope ────────────────────────────────────
ALTER TABLE "LibraryCategoryTierWriteScope" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "LibraryCategoryTierWriteScope_select_admin"
  ON "LibraryCategoryTierWriteScope" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "LibraryCategory" c
      WHERE c."id" = "LibraryCategoryTierWriteScope"."categoryId"
        AND (public.is_place_admin(c."placeId") OR public.is_place_owner(c."placeId"))
    )
  );

-- ── LibraryCategoryUserWriteScope ────────────────────────────────────
ALTER TABLE "LibraryCategoryUserWriteScope" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "LibraryCategoryUserWriteScope_select_admin"
  ON "LibraryCategoryUserWriteScope" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "LibraryCategory" c
      WHERE c."id" = "LibraryCategoryUserWriteScope"."categoryId"
        AND (public.is_place_admin(c."placeId") OR public.is_place_owner(c."placeId"))
    )
  );
