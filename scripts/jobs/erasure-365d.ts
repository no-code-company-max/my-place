/**
 * Runbook CLI del job de erasure 365d (C.L).
 *
 * Invocación:
 *   pnpm tsx scripts/jobs/erasure-365d.ts [--dry-run]
 *
 * Útiles:
 * - Testing local antes del primer deploy.
 * - Ejecución manual por admin si el Vercel Cron diario falla (no hace
 *   retry automático).
 * - Inspección segura: `--dry-run` captura snapshots en `ErasureAuditLog`
 *   con `dryRun=true` sin aplicar UPDATEs.
 *
 * Ver `docs/decisions/2026-04-24-erasure-365d.md`.
 */
import { runErasure } from '@/features/members/public.server'

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run')
  const result = await runErasure({ dryRun })
  console.log(JSON.stringify(result, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
