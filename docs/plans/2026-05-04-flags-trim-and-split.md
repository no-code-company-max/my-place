# Plan — Trim + sub-split de `flags/` (placeholder)

**Fecha:** 2026-05-04 (placeholder)
**Estado:** Pendiente — audit completo, plan a redactar.
**ADR:** `docs/decisions/2026-05-04-library-root-sub-split.md` (decisión meta).

## Estado

Audit del slice realizado el 2026-05-04. Hallazgos:

- **LOC actual**: 1643 prod (apenas 9% sobre cap).
- **Estrategia híbrida**:
  - **Fase 1: Trim**. El agent reportó que ~40% del slice son comments/docstrings. CLAUDE.md dice "default to writing no comments". Trim agresivo de docstrings que no aportan WHY no obvio puede bajar a ~1300-1400 LOC.
  - **Fase 2 (si trim no alcanza): sub-split vertical** en 2 sub-slices:
    - `flags/create-flow/` (~400 LOC) — flag-modal + flag-button + create action + tests.
    - `flags/review-queue/` (~620 LOC) — flag-queue-item + review action + flag-view-mapper + tests.
  - Raíz: ~620 LOC (domain/types, schemas, queries, primitives).

## Razón para el sub-split potencial

División por **sub-dominio cohesivo** (UX flow), no por CRUD verb. El user que reporta y el admin que modera son dos audiencias y dos contextos diferentes — patrón vertical correcto.

## Próximos pasos

Redactar plan completo. Empezar por trim de comments antes de decidir sub-split; medir delta real antes de cargar trabajo extra.

Cuando este plan se cierre, eliminar la entry `flags` (temporal) del `WHITELIST` en `scripts/lint/check-slice-size.ts`.
