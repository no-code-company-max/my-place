-- Plan A S4 (Hallazgo #2) — RLS read-scope de biblioteca.
--
-- Cierra una CONTRADICCIÓN ACTIVA documentada: los ADR
-- `2026-05-04-library-courses-and-read-access` y
-- `2026-05-12-library-permissions-model` especifican RLS SELECT por
-- `readAccessKind` con un helper `is_in_category_read_scope`. El código
-- implementó SOLO el lado write (INSERT, migración 20260513000000); el
-- read SELECT (`LibraryItem_select_member_or_admin`, migración
-- 20260430010000) nunca se actualizó → a nivel SQL cualquier miembro
-- ve todo item, ignorando categorías restringidas.
--
-- Estrategia (ADR 2026-05-15): policy escrita + testeada en harness AHORA,
-- SIN activar runtime (Prisma sigue con service-role; el switch runtime
-- holístico es paso aparte pre-launch). Este RLS es backstop de defensa
-- en profundidad: acceso directo a la DB / clientes RLS-aware / bugs
-- futuros del app-layer. La puerta efectiva en MVP es app-layer
-- (`library/access/server/assert-readable.ts`, Plan A S1-S3).
--
-- Espeja la lógica de `canReadCategory || canWriteCategory` (write
-- implica read — un contributor fuera del read-scope NO pierde lectura
-- de la categoría donde escribe). Mismo patrón SQL que
-- `LibraryItem_insert_with_write_access` (migración 20260513000000).

-- ────────────────────────────────────────────────────────────────────────
-- Helper: ¿el viewer (auth.uid()) está en el read-scope efectivo de la
-- categoría? = canReadCategory OR canWriteCategory.
--   - owner del place: siempre (decisión #C ADR 2026-05-04).
--   - readAccessKind=PUBLIC: cualquiera.
--   - GROUPS/TIERS/USERS read scope: match.
--   - write scope (GROUPS/TIERS/USERS): write implica read.
--   - writeAccessKind=OWNER_ONLY: ya cubierto por is_place_owner.
-- SECURITY INVOKER + search_path fijo (mismo contrato que is_place_admin
-- / is_place_owner). auth.uid() lee request.jwt.claims->>'sub'.
-- ────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_in_category_read_scope(category_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM "LibraryCategory" c
    WHERE c."id" = category_id
      AND (
        public.is_place_owner(c."placeId")
        OR c."readAccessKind" = 'PUBLIC'
        OR (
          c."readAccessKind" = 'GROUPS'
          AND EXISTS (
            SELECT 1 FROM "LibraryCategoryGroupReadScope" rs
            INNER JOIN "GroupMembership" gm ON gm."groupId" = rs."groupId"
            WHERE rs."categoryId" = c."id"
              AND gm."userId" = auth.uid()::text
              AND gm."placeId" = c."placeId"
          )
        )
        OR (
          c."readAccessKind" = 'TIERS'
          AND EXISTS (
            SELECT 1 FROM "LibraryCategoryTierReadScope" rs
            INNER JOIN "TierMembership" tm ON tm."tierId" = rs."tierId"
            WHERE rs."categoryId" = c."id"
              AND tm."userId" = auth.uid()::text
              AND tm."placeId" = c."placeId"
              AND (tm."expiresAt" IS NULL OR tm."expiresAt" > NOW())
          )
        )
        OR (
          c."readAccessKind" = 'USERS'
          AND EXISTS (
            SELECT 1 FROM "LibraryCategoryUserReadScope" rs
            WHERE rs."categoryId" = c."id"
              AND rs."userId" = auth.uid()::text
          )
        )
        -- write implica read (decisión B Plan A)
        OR (
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
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_in_category_read_scope(TEXT) TO authenticated, anon;

-- ────────────────────────────────────────────────────────────────────────
-- Reemplaza la policy SELECT para sumar el gate de read-scope.
--
-- Preserva las excepciones de la policy original:
--   - `is_active_member` + visibilidad de archivados (admin/author) intactas.
--   - author SIEMPRE ve su item: sin esto, archivar/perder read-scope del
--     propio item lo volvería invisible y Postgres bloquearía el UPDATE
--     como "blind write" (security feature ≥13). Idéntico razonamiento que
--     la policy original.
--   - admin ve para audit/restore. Asimetría consciente vs app-layer:
--     `canReadCategory` niega admin-no-owner en categorías restringidas
--     (decisión ADR 2026-05-04), pero a nivel RLS el admin conserva acceso
--     para no romper audit/restore de archivados. Aceptable: RLS es
--     backstop (no la puerta efectiva — service-role la bypassa en
--     runtime) y un admin con DB access es confianza alta. Documentado en
--     ADR 2026-05-15.
-- ────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "LibraryItem_select_member_or_admin" ON "LibraryItem";

CREATE POLICY "LibraryItem_select_member_or_admin" ON "LibraryItem"
  FOR SELECT
  USING (
    public.is_active_member("placeId")
    AND (
      "archivedAt" IS NULL
      OR public.is_place_admin("placeId")
      OR "authorUserId" = auth.uid()::text
    )
    AND (
      public.is_in_category_read_scope("categoryId")
      OR public.is_place_admin("placeId")
      OR "authorUserId" = auth.uid()::text
    )
  );
