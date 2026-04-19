import { NextResponse } from 'next/server'
import { prisma } from '@/db/client'
import { logger } from '@/shared/lib/logger'

/**
 * Health check. Devuelve 200 + metadata si DB responde, 503 si no.
 * Pensado para uptime monitors y CI smoke tests.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({
      ok: true,
      db: 'up',
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    logger.error({ err }, 'health check failed')
    return NextResponse.json(
      { ok: false, db: 'down', timestamp: new Date().toISOString() },
      { status: 503 },
    )
  }
}
