-- F.5 — feature flags por place: cada place puede activar/desactivar
-- los 4 plugins de embed (YouTube, Spotify, Apple Podcasts, Ivoox).
-- Default abierto: places existentes estrenan los 4 plugins activos.
ALTER TABLE "Place" ADD COLUMN "editorPluginsConfig" JSONB
  NOT NULL
  DEFAULT '{"youtube":true,"spotify":true,"applePodcasts":true,"ivoox":true}'::jsonb;
