import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { logger } from '@/shared/lib/logger'

/**
 * Singleton de PrismaClient + pg.Pool.
 *
 * Estrategia: usamos `@prisma/adapter-pg` (driver adapter in-process) en
 * vez del binary engine de Prisma. El binary engine spawneaba un
 * subproceso Rust por cliente y comunicaba via HTTP localhost — overhead
 * inadecuado para Vercel serverless con cold starts frecuentes (medido:
 * ~640ms por query agregados sólo por el subprocess + JSON HTTP). El
 * adapter elimina el subprocess; queries van directo node-postgres → DB.
 *
 * Pool config:
 *  - `max=1` reproduce el comportamiento de `?connection_limit=1` que
 *    teníamos antes: cada lambda hold 1 conexión al pooler de Supabase,
 *    evita saturar PgBouncer (~15 conexiones free tier).
 *  - Override vía `PG_POOL_MAX` env var: `PG_POOL_MAX=10` en dev local
 *    para paralelismo real.
 *
 * El pattern `globalThis` evita múltiples instancias durante hot-reload
 * en dev (cada recarga crearía una conexión nueva y agotaría el pool).
 *
 * En dev sumamos un middleware `$use` que loguea cada query via pino con
 * `requestId` — imprescindible para correlacionar bursts entre navegación
 * real y prefetch de Next. Prisma 5 deja `$use` deprecado pero funcional;
 * usarlo acá evita el inflado de tipos que sí provoca `$extends({ query })`
 * en los `prisma.$transaction(async (tx) => …)` del resto del código.
 */
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
  pgPool?: Pool
}

const isDev = process.env.NODE_ENV === 'development'
// Opt-in para activar el query log en builds de producción local
// (`pnpm start`) cuando corremos `scripts/perf/measure-perf.ts`. Sin esto
// el log default es `['error']` y no podemos correlacionar queries con
// un request real al servidor warm-cache.
const isPerfRun = process.env.PERF_LOG === '1'
const enableQueryLog = isDev || isPerfRun

function createPool(): Pool {
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.PG_POOL_MAX ?? 1),
  })
}

function createPrisma(pool: Pool): PrismaClient {
  const adapter = new PrismaPg(pool)
  const client = new PrismaClient({
    adapter,
    log: enableQueryLog ? ['error', 'warn'] : ['error'],
  })

  if (enableQueryLog) {
    client.$use(async (params, next) => {
      const start = performance.now()
      try {
        return await next(params)
      } finally {
        const durationMs = Math.round(performance.now() - start)
        const requestId = await tryGetRequestId()
        logger.debug(
          {
            requestId,
            model: params.model,
            action: params.action,
            durationMs,
          },
          'prisma query',
        )
      }
    })
  }

  return client
}

const pgPool: Pool = globalForPrisma.pgPool ?? createPool()
export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrisma(pgPool)

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.pgPool = pgPool
  globalForPrisma.prisma = prisma
}

/**
 * Resuelve `x-request-id` de la request Next actual, si existe. El middleware
 * inyecta el header en cada request (`src/middleware.ts`), así que en todo
 * RSC / Server Action / Route Handler vamos a tenerlo. En background tasks
 * (fire-and-forget disparados desde un layout, ej: `findOrCreateCurrentOpening`)
 * el contexto puede haberse perdido — `headers()` tira y caemos a `undefined`,
 * lo cual es informativo: esos queries no pertenecen a ninguna request "viva".
 */
async function tryGetRequestId(): Promise<string | undefined> {
  try {
    const { headers } = await import('next/headers')
    const h = await headers()
    return h.get('x-request-id') ?? undefined
  } catch {
    return undefined
  }
}
