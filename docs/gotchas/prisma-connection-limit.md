# `connection_limit=1` en `DATABASE_URL` es serverless-safe pero serializa queries en dev local

El default del `.env.example` viene con `?pgbouncer=true&connection_limit=1`. Es intencional para Vercel: cada lambda invocation maneja una sola conexión, multiplexada por el pooler Supavisor.

En dev local (no serverless), ese cap **anula la paralelización**: aunque uses `Promise.all` para disparar queries concurrentes, Prisma las ejecuta una por una sobre la única conexión.

**Síntoma:** una page con 8 queries via `Promise.all` tarda igual que 8 secuenciales (~200ms RTT × 8 = 1.6s solo en network).

**Fix dev:** editar `.env.local` y subir a `?pgbouncer=true&connection_limit=10`. **NO** cambiar el `.env.example` ni el valor en prod sin entender la implicación de saturar el pooler. Reiniciar el dev server después del cambio (mismo gotcha de [PrismaClient cacheado](./database-url-prisma-cache.md)).
