-- Migración del feature Tier (T.1).
--
-- Crea la primitiva `Tier`: definición + visibilidad. Owner-only CRUD a nivel
-- app (server actions con findPlaceOwnership + UI gate). RLS se suma cuando
-- llegue el plan unificado (ver docs/decisions/2026-05-01-rls-comprehensive-pre-launch.md).
--
-- Sin asignación a usuarios (`TierMembership` v2). Sin paywall. Sin pagos.
-- Plan + spec: docs/features/tiers/spec.md.
-- ADR del modelo:  docs/decisions/2026-05-02-tier-model.md.

-- ---------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------

-- 6 valores canónicos de duración. Helper puro `tierDurationToDays()` deriva
-- días concretos cuando hace falta. Cuando llegue Stripe Connect, cada valor
-- mapea a `interval` + `interval_count` sin ambigüedad.
CREATE TYPE "TierDuration" AS ENUM (
  'SEVEN_DAYS',
  'FIFTEEN_DAYS',
  'ONE_MONTH',
  'THREE_MONTHS',
  'SIX_MONTHS',
  'ONE_YEAR'
);

-- Visibilidad binaria. Sin estados intermedios (DRAFT/SCHEDULED) — scope creep
-- sin caso de uso v1. HIDDEN = oculto a members; el owner sigue viéndolo en
-- /settings/tiers.
CREATE TYPE "TierVisibility" AS ENUM ('PUBLISHED', 'HIDDEN');

-- ---------------------------------------------------------------
-- 2. Tabla Tier
-- ---------------------------------------------------------------

-- priceCents = 0 ⇒ tier gratis. Cap defensivo en Zod (max 999_999) — DB acepta
-- más por si el cap sube cuando llegue Stripe.
-- currency hardcoded 'USD' v1; Stripe Connect Express en LATAM solo soporta
-- USD/BRL/MXN — ARS no es opción. Cuando llegue Stripe, el enum Zod se
-- extiende; la columna no cambia.
-- visibility default HIDDEN — los tiers nuevos arrancan ocultos. Owner los
-- publica explícitamente cuando estén listos.
CREATE TABLE "Tier" (
  "id"          TEXT            NOT NULL,
  "placeId"     TEXT            NOT NULL,
  "name"        VARCHAR(60)     NOT NULL,
  "description" VARCHAR(280),
  "priceCents"  INTEGER         NOT NULL,
  "currency"    VARCHAR(3)      NOT NULL DEFAULT 'USD',
  "duration"    "TierDuration"  NOT NULL,
  "visibility"  "TierVisibility" NOT NULL DEFAULT 'HIDDEN',
  "createdAt"   TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3)    NOT NULL,

  CONSTRAINT "Tier_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------
-- 3. Indexes
-- ---------------------------------------------------------------

-- Filtro principal de queries:
--   - Owner pide todos los tiers del place (sin filtro de visibility).
--   - Pricing pages futuros piden solo los PUBLISHED.
-- El index cubre ambos casos.
CREATE INDEX "Tier_placeId_visibility_idx" ON "Tier"("placeId", "visibility");

-- Sort de la lista admin (orden por createdAt DESC).
CREATE INDEX "Tier_placeId_createdAt_idx" ON "Tier"("placeId", "createdAt");

-- ---------------------------------------------------------------
-- 4. Foreign Keys
-- ---------------------------------------------------------------

-- onDelete CASCADE: si el Place se hard-deletea (caso erasure futuro), sus
-- tiers se borran. Place soft-archive (Place.archivedAt) NO cascadea — el
-- soft-archive no toca esta FK.
ALTER TABLE "Tier"
  ADD CONSTRAINT "Tier_placeId_fkey"
  FOREIGN KEY ("placeId") REFERENCES "Place"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
