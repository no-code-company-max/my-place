# `logger.ts` lee `process.env.LOG_LEVEL` y `process.env.NODE_ENV` DIRECTO — no vía `serverEnv`

Es deliberado. `LOG_LEVEL` está declarado en el schema Zod de `shared/config/env.ts` para que Zod valide su valor (enum pino levels), pero el `logger.ts` **NO** accede a `serverEnv.LOG_LEVEL`.

**Razón:** el logger se importa desde muchos paths (tests, actions, middleware) — migrar al Proxy `serverEnv` fuerza parse eager del env en cualquier test que importe el logger indirecto, rompiendo decenas de test files que no mockean env completo. Se intentó en 2026-04-21 y se revirtió.

**No unificar.**

La validación Zod se dispara igual cuando otro código accede a `serverEnv`. Si alguien intenta "limpiar" esto, va a romper ~7 test files con `[env] server env invalid` en cascada.
