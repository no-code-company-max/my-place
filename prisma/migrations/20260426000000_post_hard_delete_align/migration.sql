-- Post hard-delete alignment (C.G.1).
--
-- Contexto: el ADR `docs/decisions/2026-04-21-post-hard-delete.md` decidió que
-- Post pasa a hard delete (la fila desaparece en una tx con cascade FK + cleanup
-- polimórfico de reactions/flags). El cambio se ejecutó originalmente sobre
-- `my-place` vía SQL Editor de Supabase (fuera de la historia de Prisma). Esta
-- migración codifica esos pasos para que un fresh deploy (CI branches,
-- ambientes nuevos) llegue al mismo schema y comportamiento que prod.
--
-- Idempotencia: todas las operaciones usan `IF EXISTS` / `IF NOT EXISTS` /
-- `CREATE OR REPLACE`. Aplicar sobre `my-place` (DB que ya tiene este estado)
-- es un no-op semántico; aplicar sobre un DB fresco con los migrations previos
-- produce el estado final esperado.
--
-- Orden: primero removemos todos los dependientes de `Post.deletedAt` (función
-- realtime, policy, índice parcial), luego la columna. Luego recreamos sin la
-- referencia.

-- 1. Dropear la función realtime que referencia `p."deletedAt"` en su body.
--    La policy `discussions_thread_receive` / `discussions_thread_track` sobre
--    `realtime.messages` depende de esta función; `DROP FUNCTION` con CASCADE
--    tiraría las policies también. Usamos `CREATE OR REPLACE` al final para
--    no requerir CASCADE — reemplazamos en sitio más abajo.
DROP FUNCTION IF EXISTS realtime.discussions_viewer_is_thread_member() CASCADE;

-- 2. Dropear la policy que filtra por `"deletedAt" IS NULL`.
DROP POLICY IF EXISTS "Post_select_active_member" ON "Post";

-- 3. Dropear el índice parcial que filtra `WHERE "deletedAt" IS NULL`.
DROP INDEX IF EXISTS "Post_placeId_lastActivityAt_active_idx";

-- 4. Dropear la columna.
ALTER TABLE "Post" DROP COLUMN IF EXISTS "deletedAt";

-- 5. Recrear índice no-parcial para lista por última actividad (sin deletedAt).
CREATE INDEX IF NOT EXISTS "Post_placeId_lastActivityAt_idx"
  ON "Post"("placeId", "lastActivityAt" DESC);

-- 6. Recrear policy sin la branch de deletedAt.
CREATE POLICY "Post_select_active_member" ON "Post"
  FOR SELECT
  USING (
    public.is_active_member("placeId")
    AND ("hiddenAt" IS NULL OR public.is_place_admin("placeId"))
  );

-- 7. Recrear función realtime sin `AND p."deletedAt" IS NULL` — ya que Post
--    es hard-delete, la fila no existe si fue eliminada, y el JOIN en el
--    EXISTS ya descarta el thread.
CREATE OR REPLACE FUNCTION realtime.discussions_viewer_is_thread_member()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM "Post" p
    JOIN "Membership" m
      ON m."placeId" = p."placeId"
     AND m."userId" = auth.uid()::text
     AND m."leftAt" IS NULL
    WHERE p.id = realtime.discussions_post_id_from_topic()
  )
$$;

-- 8. Recrear las policies sobre `realtime.messages` que dependían de la función
--    (CASCADE del paso 1 las tiró). Se mantienen idénticas al SQL original en
--    `20260424000000_realtime_discussions_presence/migration.sql`.
DROP POLICY IF EXISTS "discussions_thread_receive" ON realtime.messages;
CREATE POLICY "discussions_thread_receive"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() LIKE 'post:%'
  AND realtime.discussions_viewer_is_thread_member()
);

DROP POLICY IF EXISTS "discussions_thread_send" ON realtime.messages;
CREATE POLICY "discussions_thread_send"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.topic() LIKE 'post:%'
  AND realtime.discussions_viewer_is_thread_member()
);
