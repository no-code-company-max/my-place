-- Extensión de cobertura del job Erasure 365d para Flag y LibraryItem.
--
-- Plan derivado del audit checklist 2026-05-01 (M5). Permite que el job
-- nullifique la identidad del reporter de un flag o del autor de un library
-- item siguiendo el patrón establecido en Post/Comment/Event:
--   `*UserId` → NULL + `*Snapshot` → { displayName: 'ex-miembro', ... }.
--
-- Ver `docs/plans/2026-05-01-erasure-coverage-extension.md` para el rationale.

-- ---------------------------------------------------------------
-- 1. Agregar columnas snapshot (nullable inicialmente para backfill).
-- ---------------------------------------------------------------

ALTER TABLE "Flag" ADD COLUMN "reporterSnapshot" JSONB;
ALTER TABLE "LibraryItem" ADD COLUMN "authorSnapshot" JSONB;

-- ---------------------------------------------------------------
-- 2. Backfill desde User.
-- ---------------------------------------------------------------

-- Flag: reporterSnapshot = { displayName, avatarUrl } del reporter actual.
-- reporterUserId es NOT NULL hoy → el join siempre matchea.
UPDATE "Flag" f
SET "reporterSnapshot" = jsonb_build_object(
  'displayName', u."displayName",
  'avatarUrl', u."avatarUrl"
)
FROM "User" u
WHERE f."reporterUserId" = u.id;

-- LibraryItem: authorSnapshot = { displayName, avatarUrl } del autor.
-- Si authorUserId es NULL (post-erasure pre-existente sobre Post pero no
-- LibraryItem en el job viejo), usar 'ex-miembro' como fallback.
UPDATE "LibraryItem" li
SET "authorSnapshot" = CASE
  WHEN li."authorUserId" IS NULL THEN jsonb_build_object(
    'displayName', 'ex-miembro',
    'avatarUrl', NULL
  )
  ELSE (
    SELECT jsonb_build_object(
      'displayName', u."displayName",
      'avatarUrl', u."avatarUrl"
    )
    FROM "User" u
    WHERE u.id = li."authorUserId"
  )
END;

-- ---------------------------------------------------------------
-- 3. Set NOT NULL después del backfill.
-- ---------------------------------------------------------------

ALTER TABLE "Flag" ALTER COLUMN "reporterSnapshot" SET NOT NULL;
ALTER TABLE "LibraryItem" ALTER COLUMN "authorSnapshot" SET NOT NULL;

-- ---------------------------------------------------------------
-- 4. Flag.reporterUserId: nullable + FK SetNull.
--
-- LibraryItem.authorUserId ya es nullable + SetNull (precedente de Event).
-- Solo Flag necesita el cambio.
-- ---------------------------------------------------------------

ALTER TABLE "Flag" ALTER COLUMN "reporterUserId" DROP NOT NULL;

ALTER TABLE "Flag" DROP CONSTRAINT "Flag_reporterUserId_fkey";

ALTER TABLE "Flag" ADD CONSTRAINT "Flag_reporterUserId_fkey"
  FOREIGN KEY ("reporterUserId")
  REFERENCES "User"(id)
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- ---------------------------------------------------------------
-- Notas RLS:
--
-- La policy `Flag_select_admin_or_reporter` chequea
-- `reporterUserId = auth.uid()::text`. Con reporterUserId nullable, post-
-- erasure el reporter ya no tiene visibilidad sobre sus flags pasados — solo
-- los admins. Comportamiento intencional: el ex-reporter ya no es parte del
-- place y su identidad fue removida.
--
-- La policy `Flag_insert_self_reporter` requiere reporterUserId =
-- auth.uid()::text al insertar. No cambia: en el momento del insert el
-- reporter está activo y reporterUserId nunca es NULL.
-- ---------------------------------------------------------------
