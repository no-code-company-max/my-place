# ADR — Split DATABASE_URL dev/prod via DEV_DATABASE_URL

**Fecha**: 2026-05-01
**Estado**: Aceptada
**Contexto**: B3 del audit checklist (`docs/plans/2026-05-01-audit-checklist.md`).

## Problema

El `.env.example` setea `DATABASE_URL` con `?pgbouncer=true&connection_limit=1`. Este valor es serverless-safe para Vercel — cada lambda invocation maneja UNA conexión y el pooler Supavisor multiplexea contra Postgres. El cap=1 previene saturar el pool del proyecto Supabase bajo concurrencia alta.

Pero en **dev local** (no serverless), el cap=1 serializa cualquier `Promise.all` de queries Prisma. Medición sobre el codebase actual (auditoría 2026-05-01):

- `conversations/[postSlug]/page.tsx` — 7 queries paralelas → ~700ms overhead con RTT=100ms.
- `conversations/page.tsx` — 4 queries → ~400ms.
- `library/page.tsx` — 3 queries → ~300ms.
- Flujo típico (home → conversations → post detail) acumula ~1.5s de overhead puro de red por la serialización forzada.

El gotcha estaba documentado en CLAUDE.md, pero el workaround propuesto ("editá `.env.local` manualmente y subilo a `connection_limit=10`") obliga a cada dev a tocar la URL de la DB y a tener cuidado de no commitearla a `.env.example`.

## Estado de la recomendación oficial (2025-2026)

Investigación (2026-05-01): la guía clásica de Supabase + Prisma + Vercel asumía que cada lambda servía una request. Con **Vercel Fluid Compute** (default desde feb-2025), una instancia sirve múltiples invocaciones concurrentes ⇒ `connection_limit=1` no protege nada y degrada throughput. Vercel KB explícito: _"avoid max pool size of 1 as this does not reduce total connections and harms concurrency in Fluid Compute"_.

Status quo de Place: `connection_limit=1` se mantiene en prod hasta confirmar Fluid Compute en el dashboard del proyecto Vercel. Si Fluid está activo, prod debería migrar a `connection_limit=5` o adoptar `@prisma/adapter-pg + attachDatabasePool` cuando Prisma 7 sea estable. **Esa decisión queda diferida** a un follow-up — esta ADR solo cubre el split dev/prod.

## Decisión

Introducir un override **opcional, solo-dev**: `DEV_DATABASE_URL`.

- `src/shared/config/env.ts`: nuevo `DEV_DATABASE_URL: z.string().url().optional()`.
- `src/db/client.ts`: `resolveDatasourceUrl()` lee `process.env.DEV_DATABASE_URL ?? process.env.DATABASE_URL` cuando `NODE_ENV !== 'production'`. En prod siempre usa `DATABASE_URL`. Pasa el resultado al `PrismaClient` via `datasourceUrl`.
- `.env.example`: documenta dos modos recomendados:
  - **Modo A**: `DEV_DATABASE_URL = DIRECT_URL` (puerto 5432, sin pooler). Mejor latencia + prepared statements activos.
  - **Modo B**: `DEV_DATABASE_URL = pooler con connection_limit=10`. Paridad con prod, paraleliza igual.

El `.env.example` mantiene `DATABASE_URL` con `connection_limit=1` (serverless-safe) y deja `DEV_DATABASE_URL` comentada con ambas opciones.

## Trade-offs

- **Ganancia**: paralelización real de `Promise.all` en dev (estimado: −1s acumulado en navegación típica). Sin tocar el template `.env.example`. Sin riesgo de commitear accidentalmente un valor laxo a prod.
- **Costo**: 1 env var extra (opcional). El dev tiene que enterarse de que existe (cubierto en `.env.example` + CLAUDE.md gotcha actualizado).
- **Riesgo de divergencia dev/prod**: si dev usa Modo A (DIRECT_URL), corre con prepared statements activos mientras prod los desactiva (`pgbouncer=true`). Bugs específicos de pooled mode no aparecen en dev. Mitigación: la suite E2E corre contra el pooler (puerto 6543) en CI, así que esos casos siguen cubiertos. Modo B evita la divergencia a costa de +5-15ms por query.

## Alternativas descartadas

1. **Cambiar el default del `.env.example` a `connection_limit=10`**: rompe la garantía serverless-safe del template para nuevos devs que copian sin pensar. Si alguien copia a prod literal, satura el pool.
2. **Auto-bumpear `connection_limit` en `db/client.ts` cuando `NODE_ENV !== 'production'`**: requiere parsear y reescribir la URL. Frágil. No respeta config explícita del dev.
3. **Adoptar `@prisma/adapter-pg + attachDatabasePool` ahora**: cambio mayor, dependencias nuevas, requiere Prisma 7 estable. Diferido.

## Verificación

- `pnpm typecheck` ✅
- `pnpm lint` ✅
- `pnpm test` ✅ (sin nuevos tests — el cambio es config + sin lógica nueva)
- `pnpm build` ✅
- Manual: con `DEV_DATABASE_URL` no seteada, comportamiento idéntico al anterior (fallback a `DATABASE_URL`). Con `DEV_DATABASE_URL` seteada, queries en `Promise.all` se ejecutan en paralelo (verificable via logs `prisma query` con `durationMs` solapados).

## Follow-ups

- Confirmar Fluid Compute status en el proyecto Vercel y revisar `connection_limit` de prod si está activo (ADR aparte).
- Cuando Prisma 7 sea estable: evaluar migración a `@prisma/adapter-pg` + `attachDatabasePool`.

## Referencias

- [Supabase + Prisma docs](https://supabase.com/docs/guides/database/prisma)
- [Vercel KB — Fluid Compute + DB pools](https://vercel.com/kb/guide/efficiently-manage-database-connection-pools-with-fluid-compute)
- [Supabase Discussion #40671 — Supavisor + Fluid](https://github.com/orgs/supabase/discussions/40671)
- `docs/plans/2026-05-01-audit-checklist.md` (B3)
