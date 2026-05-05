-- Invariante: máximo 1 tier `PUBLISHED` por (placeId, name) case-insensitive.
--
-- Caso de uso (decisión #11 actualizada del ADR tier-model):
--   Owner crea "Basic" $1.99/mes, lo publica. Después decide cambiar precio
--   a $2.99/mes pero quiere mantener "Basic" $1.99 vivo (oculto) por
--   compatibilidad histórica. La operación es:
--     1. Ocultar el "Basic" $1.99 actual (visibility = HIDDEN).
--     2. Crear nuevo "Basic" $2.99 (arranca HIDDEN por default).
--     3. Publicar el nuevo "Basic" $2.99 (visibility = PUBLISHED).
--   En cualquier momento del flow hay máximo UN "Basic" PUBLISHED.
--
-- El index parcial garantiza la invariante a nivel DB:
--   - Permite N rows con mismo (placeId, name) lower-case si están HIDDEN.
--   - Bloquea un segundo PUBLISHED con mismo (placeId, name) lower-case.
--
-- Prisma 5 NO soporta partial unique index declarativo (issue prisma#3387).
-- El index existe en DB pero NO se refleja en `prisma/schema.prisma` —
-- documentado con comentario inline en el modelo `Tier`. El cliente Prisma
-- recibe un `P2002` cuando se intenta INSERT/UPDATE que viole el index;
-- las server actions catchean ese código y lo mapean a un return
-- discriminated union friendly (`{ ok: false, error: 'name_already_published' }`).
--
-- LOWER(name) — case-insensitive. Combinado con `name.trim()` aplicado por
-- las server actions antes del INSERT/UPDATE, garantiza que "Basic",
-- "basic", "BASIC", "  Basic  " son tratados como el mismo nombre.

CREATE UNIQUE INDEX "Tier_placeId_lowerName_published_unique"
  ON "Tier" ("placeId", LOWER("name"))
  WHERE "visibility" = 'PUBLISHED';
