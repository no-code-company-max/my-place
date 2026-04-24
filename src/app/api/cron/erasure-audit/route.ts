import { timingSafeEqual } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/db/client'
import { serverEnv } from '@/shared/config/env'
import { logger } from '@/shared/lib/logger'

export const runtime = 'nodejs'
export const maxDuration = 60

const ERASURE_WINDOW_MS = 365 * 24 * 60 * 60 * 1000

/**
 * GET /api/cron/erasure-audit
 *
 * Invocado semanalmente (domingo 04:00 UTC, `vercel.json`). Count-only:
 * cuenta `Membership` elegibles para erasure que SIGUEN sin procesar
 * (`leftAt + 365d < now()` AND `erasureAppliedAt IS NULL` AND place
 * no archivado).
 *
 * Razón: Vercel Cron NO retry en 5xx — si el cron diario primario falla
 * silenciosamente, este audit detecta el backlog y loguea warn. Admin
 * revisa Vercel Functions logs semanalmente.
 *
 * Ver ADR `docs/decisions/2026-04-24-erasure-365d.md`.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const cutoff = new Date(Date.now() - ERASURE_WINDOW_MS)
  const backlog = await prisma.membership.count({
    where: {
      leftAt: { lt: cutoff },
      erasureAppliedAt: null,
      place: { archivedAt: null },
    },
  })
  if (backlog > 0) {
    logger.warn(
      { event: 'erasureBacklog', count: backlog },
      'erasure 365d backlog detected — cron principal puede estar fallando',
    )
  } else {
    logger.info({ event: 'erasureAuditClean' }, 'erasure 365d sin backlog')
  }
  return NextResponse.json({ ok: true, backlog })
}

function isAuthorized(req: NextRequest): boolean {
  const secret = serverEnv.CRON_SECRET
  if (!secret) return false
  const header = req.headers.get('authorization') ?? ''
  const expected = `Bearer ${secret}`
  if (header.length !== expected.length) return false
  try {
    return timingSafeEqual(Buffer.from(header), Buffer.from(expected))
  } catch {
    return false
  }
}
