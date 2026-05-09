# Cambiar `DATABASE_URL` / `DIRECT_URL` requiere reiniciar el dev server

Next reloca `.env.local` en hot reload, pero el `PrismaClient` vive cacheado en `globalThis` (ver `src/db/client.ts`), así que sigue usando la URL vieja hasta que matás el proceso.

**Síntoma:** cambiás el hostname del pooler, guardás, y `/api/health` sigue tirando el mismo error de conexión.

**Fix:** matar y volver a levantar `pnpm dev` después de cualquier cambio en `DATABASE_URL` o `DIRECT_URL`.
