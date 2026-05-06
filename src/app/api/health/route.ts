import { NextResponse } from 'next/server'
import { prisma } from '@/db/client'
import { logger } from '@/shared/lib/logger'

/**
 * Health check. Devuelve 200 + metadata si DB responde, 503 si no.
 * Pensado para uptime monitors y CI smoke tests.
 *
 * Cache-Control 10s (public + s-maxage) para que CDN/balanceador absorban
 * pings frecuentes sin tocar DB cada vez. TTL bajo para no enmascarar
 * caídas reales más allá de 10s.
 */
const HEALTH_CACHE_HEADER = 'public, max-age=10, s-maxage=10'

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json(
      {
        ok: true,
        db: 'up',
        timestamp: new Date().toISOString(),
      },
      { headers: { 'Cache-Control': HEALTH_CACHE_HEADER } },
    )
  } catch (err) {
    logger.error({ err }, 'health check failed')
    return NextResponse.json(
      { ok: false, db: 'down', timestamp: new Date().toISOString() },
      { status: 503 },
    )
  }
}
