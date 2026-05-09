# Vercel Cron usa GET (no POST) — `vercel.json` no soporta method/headers/body

El patrón correcto es `export async function GET(req: NextRequest)` en el route handler. Vercel inyecta `Authorization: Bearer <CRON_SECRET>` automáticamente si el env var está configurada.

**Vercel NO reintenta 5xx** — si el cron falla, se pierde hasta el próximo schedule. Mitigación: segundo cron de audit (ej: `/api/cron/erasure-audit` semanal) que cuente backlog y loguee warn.

**Vercel puede duplicar eventos** — los handlers deben ser idempotentes + usar advisory lock Postgres (`pg_try_advisory_lock`) si la concurrencia importa.

`runtime = 'nodejs'` + `maxDuration = 300` explícitos en el route (default puede romperse en upgrades de Next).

Ver ADR `docs/decisions/2026-04-24-erasure-365d.md` (primer cron del repo, precedente para futuros).

**Instant Rollback de Vercel NO actualiza crons** — si se rollbackea un deploy que cambió `vercel.json`, los schedules viejos siguen.
