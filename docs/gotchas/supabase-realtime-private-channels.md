# Supabase Realtime: "Allow public access to channels" debe estar OFF en cada ambiente

Dashboard → Realtime → Settings → toggle `Allow public access to channels` → **OFF**.

- Con **ON**, un cliente puede abrir un canal sin `{ config: { private: true } }` y bypassear las policies de `realtime.messages`.
- Con **OFF**, Supabase rechaza cualquier canal no-private y las policies siempre aplican.

Nuestro código ya abre todos los canales con `private: true` (ver `thread-presence.tsx`), así que desactivar public access no rompe nada — enforcea la postura robusta.

**Checklist obligatorio antes del primer deploy con private channels** (C.F en adelante).

**Verificación:** un user sin membership intentando `supabase.channel('post:<id>', { config: { private: true } }).subscribe()` debe devolver `CHANNEL_ERROR`.

**Nota:** este toggle antes se llamaba "Enable Realtime Authorization" con semántica inversa; Supabase lo renombró y lo movió a Realtime → Settings (no a Project Settings → Realtime).
