-- Suma columna `asOwner` a Invitation. Default false → backwards compat
-- con todas las invitaciones existentes (que se interpretaban como member
-- o admin). El nuevo flow de /settings/access invita owners (asOwner=true);
-- el accept aplica PlaceOwnership además de Membership.
--
-- App-layer enforce mutual exclusion (asAdmin XOR asOwner). DB no agrega
-- check constraint para no rigidizar el modelo si en el futuro se agregan
-- combinaciones.

ALTER TABLE "Invitation"
  ADD COLUMN "asOwner" BOOLEAN NOT NULL DEFAULT false;
