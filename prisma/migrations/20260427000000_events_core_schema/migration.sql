-- Slice `events` (F.B de Fase 6): schema core + RLS policies.
-- Ver docs/features/events/spec.md § 4 (modelo) y § 6 (RLS).
--
-- Decisiones de diseño encodeadas en esta migración:
--   1. `Event.authorUserId` nullable + `authorSnapshot jsonb` → erasure 365d
--      (mismo patrón que Post/Comment). Al cumplirse 365d desde leftAt, el
--      job runErasure (PR-3 en F.C) nullifica el FK + renombra displayName
--      a "ex-miembro" preservando el contenido del evento.
--   2. `Event.postId` nullable + `@unique` → 1:1 con el thread auto-creado
--      (auto-thread tx atómica en createEventAction, F.E). Nullable resuelve
--      el chicken-and-egg de la tx (Event → Post → UPDATE postId).
--      `onDelete: SetNull` permite que el Post desaparezca sin arrastrar el
--      evento (defensivo a futuro: discussions deshabilitada por place).
--   3. `cancelledAt` para soft-cancel — preserva RSVPs como señal histórica
--      + el thread sigue vivo. DELETE de Event prohibido para authenticated
--      via RLS (no policy DELETE); service_role bypassea para erasure.
--   4. `startsAt`/`endsAt` como `timestamptz(3)` → instante absoluto en UTC.
--      Columna `timezone TEXT` separada captura el IANA "intencional" del
--      evento. Distinto a hours (time-of-day patterns en local-place).
--   5. `EventRSVP.userId` cascadea a User para que el DELETE en erasure 365d
--      (PR-3) sea natural. NO denormalizamos placeId — la RLS de EventRSVP
--      hace subquery contra Event.placeId vía is_active_member helper.
--   6. CHECK constraint sobre `note`: sólo válido en GOING_CONDITIONAL y
--      NOT_GOING_CONTRIBUTING. Defensa en profundidad: el invariant del dominio
--      `validateRsvpNote` valida primero, el CHECK previene data corrupta si
--      un bug del server salta la validación.
--   7. CHECK constraint sobre `endsAt > startsAt` cuando endsAt presente.
--      Sanity check; el dominio valida igual con `validateEventTimes`.
--
-- El enum EVENT en `ContentTargetKind` se agrega en migración separada
-- (20260427000100_content_target_kind_add_event) por restricción Postgres
-- `ALTER TYPE ... ADD VALUE cannot run inside a transaction block`.

-- CreateEnum: estados RSVP texturados.
-- Mapeo ontológico (eventos.md § Participantes):
--   GOING                    → "voy"
--   GOING_CONDITIONAL        → "voy si X" (note explica el "si")
--   NOT_GOING_CONTRIBUTING   → "no voy pero aporto Y" (note explica el aporte)
--   NOT_GOING                → "no voy"
-- Ver docs/features/events/spec-rsvp.md § 1.
CREATE TYPE "RSVPState" AS ENUM (
  'GOING',
  'GOING_CONDITIONAL',
  'NOT_GOING_CONTRIBUTING',
  'NOT_GOING'
);

-- CreateTable Event
CREATE TABLE "Event" (
  "id" TEXT NOT NULL,
  "placeId" TEXT NOT NULL,
  "authorUserId" TEXT,
  "authorSnapshot" JSONB NOT NULL,
  "title" VARCHAR(120) NOT NULL,
  "description" JSONB,
  "startsAt" TIMESTAMPTZ(3) NOT NULL,
  "endsAt" TIMESTAMPTZ(3),
  "timezone" TEXT NOT NULL,
  "location" VARCHAR(200),
  "postId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "cancelledAt" TIMESTAMP(3),

  CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable EventRSVP
CREATE TABLE "EventRSVP" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "state" "RSVPState" NOT NULL,
  "note" VARCHAR(280),
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EventRSVP_pkey" PRIMARY KEY ("id")
);

-- Unique: el FK al thread es 1:1 (sólo un Event por Post).
CREATE UNIQUE INDEX "Event_postId_key" ON "Event"("postId");

-- Unique: máximo 1 RSVP por (event, user). Upsert idempotente.
CREATE UNIQUE INDEX "EventRSVP_eventId_userId_key" ON "EventRSVP"("eventId", "userId");

-- Indices: listado por place ordenado por fecha + filtro de cancelados.
CREATE INDEX "Event_placeId_startsAt_idx" ON "Event"("placeId", "startsAt");
CREATE INDEX "Event_placeId_cancelledAt_startsAt_idx"
  ON "Event"("placeId", "cancelledAt", "startsAt");

-- Index: agregaciones por estado dentro de un evento (count GOING, etc.).
CREATE INDEX "EventRSVP_eventId_state_idx" ON "EventRSVP"("eventId", "state");

-- Foreign keys.
ALTER TABLE "Event"
  ADD CONSTRAINT "Event_placeId_fkey"
    FOREIGN KEY ("placeId") REFERENCES "Place"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Event_authorUserId_fkey"
    FOREIGN KEY ("authorUserId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Event_postId_fkey"
    FOREIGN KEY ("postId") REFERENCES "Post"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EventRSVP"
  ADD CONSTRAINT "EventRSVP_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "Event"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "EventRSVP_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- CHECK constraints — defensa en profundidad sobre invariants del dominio.
-- Ver docs/features/events/spec.md § 4 + spec-rsvp.md § 2.
ALTER TABLE "Event"
  ADD CONSTRAINT "Event_endsAt_after_startsAt"
    CHECK ("endsAt" IS NULL OR "endsAt" > "startsAt");

ALTER TABLE "EventRSVP"
  ADD CONSTRAINT "EventRSVP_note_only_when_textured"
    CHECK ("note" IS NULL OR "state" IN ('GOING_CONDITIONAL', 'NOT_GOING_CONTRIBUTING'));

-- ========================================================================
-- Row Level Security
-- ========================================================================
--
-- Las policies usan los helpers `is_active_member` y `is_place_admin` ya
-- existentes (definidos en 20260422000100_discussions_rls). Los helpers
-- corren con SECURITY INVOKER y respetan policies del caller — Membership
-- no tiene RLS (gap global), por lo que no hay recursión.
--
-- EventRSVP usa subquery contra Event.placeId. Si Event.SELECT filtra el
-- row (ex-miembro, place archivado, etc.), la subquery devuelve NULL y
-- `is_active_member(NULL)` retorna false → la RSVP también queda invisible.
-- Coherente: si no podés ver el evento, no podés ver quién va.
--
-- Service role (jobs: erasure 365d) bypassea RLS por default Supabase.

-- ────────────────────────────────────────────────────────────────────────
-- Event
-- ────────────────────────────────────────────────────────────────────────

ALTER TABLE "Event" ENABLE ROW LEVEL SECURITY;

-- SELECT: sólo miembros activos del place ven los eventos. Ex-miembros
-- (`leftAt IS NOT NULL`) quedan invisibilizados automáticamente — incluyendo
-- eventos pasados del place que dejaron. Coherente con "Place que dejé ya
-- no me incluye". Documentado en spec.md § 6.
CREATE POLICY "Event_select_active_member" ON "Event"
  FOR SELECT
  USING (public.is_active_member("placeId"));

-- INSERT: el actor debe ser miembro activo Y autor de su propio evento.
CREATE POLICY "Event_insert_self_author" ON "Event"
  FOR INSERT
  WITH CHECK (
    public.is_active_member("placeId")
    AND "authorUserId" = auth.uid()::text
  );

-- UPDATE: autor o admin pueden modificar (cambio de título, descripción,
-- cancelación). La app enforza qué campos cambian y que `placeId` es
-- inmutable post-create (invariant en updateEventAction).
CREATE POLICY "Event_update_author_or_admin" ON "Event"
  FOR UPDATE
  USING (
    public.is_active_member("placeId")
    AND (
      "authorUserId" = auth.uid()::text
      OR public.is_place_admin("placeId")
    )
  );

-- DELETE: prohibido para authenticated. Cancelar = soft-cancel via
-- updateEventAction(cancelledAt). Hard-delete sólo via service_role
-- (erasure 365d nullifica authorUserId, no borra eventos).

-- ────────────────────────────────────────────────────────────────────────
-- EventRSVP
-- ────────────────────────────────────────────────────────────────────────

ALTER TABLE "EventRSVP" ENABLE ROW LEVEL SECURITY;

-- SELECT: miembros activos del place del evento ven todas las RSVPs.
-- La filtración por estado público (GOING / GOING_CONDITIONAL) vs privado
-- (NOT_GOING / NOT_GOING_CONTRIBUTING) se aplica en la query layer
-- (`listEventRsvps` en F.C), no en RLS — el viewer SIEMPRE puede ver su
-- propia respuesta independientemente del estado, lo que requiere lógica
-- aplicación. Ver spec-rsvp.md § 4.
CREATE POLICY "EventRSVP_select_active_member" ON "EventRSVP"
  FOR SELECT
  USING (
    public.is_active_member(
      (SELECT "placeId" FROM "Event" WHERE "id" = "eventId")
    )
  );

-- INSERT: actor debe ser miembro activo del place del evento, dueño de
-- la RSVP (no se puede RSVPear en nombre de otro), y el evento NO puede
-- estar cancelado.
CREATE POLICY "EventRSVP_insert_self_active_event" ON "EventRSVP"
  FOR INSERT
  WITH CHECK (
    public.is_active_member(
      (SELECT "placeId" FROM "Event" WHERE "id" = "eventId")
    )
    AND "userId" = auth.uid()::text
    AND (SELECT "cancelledAt" FROM "Event" WHERE "id" = "eventId") IS NULL
  );

-- UPDATE: sólo el dueño de la RSVP puede cambiarla (cambio de state +
-- note). No se valida cancelledAt acá — si el evento se canceló post-RSVP,
-- la RSVP queda como señal histórica read-only enforced por la app
-- (rsvpEventAction valida cancelledAt). RLS no agrega esa restricción para
-- permitir cleanup admin/scripts si hace falta.
CREATE POLICY "EventRSVP_update_self" ON "EventRSVP"
  FOR UPDATE
  USING ("userId" = auth.uid()::text);

-- DELETE: el dueño puede borrar su propia RSVP. Erasure 365d via service
-- role para borrar las del ex-miembro.
CREATE POLICY "EventRSVP_delete_self" ON "EventRSVP"
  FOR DELETE
  USING ("userId" = auth.uid()::text);
