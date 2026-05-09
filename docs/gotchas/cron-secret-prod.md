# `CRON_SECRET` es obligatorio en producción

Validado en `env.ts:assertProductionMailerConfig`.

**Mínimo 32 chars:** `openssl rand -hex 32`.

En dev es opcional; sin él, el endpoint `/api/cron/erasure` retorna 401 a cualquier request (incluso con header correcto).

**Rotación:** runbook de doble-secret 7 días documentado en ADR `docs/decisions/2026-04-24-erasure-365d.md`.

Comparación timing-safe con `crypto.timingSafeEqual` (no `===`).
