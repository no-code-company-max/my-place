-- Place.discoverable — visibilidad del place en el directorio público.
--
-- Default false: el place es íntimo/invisible por defecto; el owner opta
-- por listarlo. Necesario para que la RLS de acceso al place pueda
-- discriminar places listables (trabajo posterior, otra migración).

ALTER TABLE "Place" ADD COLUMN "discoverable" BOOLEAN NOT NULL DEFAULT false;
