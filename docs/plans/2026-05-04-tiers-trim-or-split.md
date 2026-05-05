# Plan — Trim o sub-split de `tiers/` (placeholder)

**Fecha:** 2026-05-04 (placeholder)
**Estado:** Pendiente — audit completo, plan a redactar.
**ADR:** `docs/decisions/2026-05-04-library-root-sub-split.md` (decisión meta).

## Estado

Audit del slice realizado el 2026-05-04. Hallazgos:

- **LOC actual**: 1608 prod (apenas 7% sobre cap).
- **Estrategia híbrida**:
  - **Fase 1: Trim**. Auditar comments/docstrings + código muerto. Si baja a ≤1500, no hay split.
  - **Fase 2 (si trim no alcanza): sub-split** en 2 sub-slices:
    - `tiers/admin/` (~600 LOC) — tier-form-sheet + tiers-list-admin + errors UI.
    - `tiers/` raíz (~1000 LOC) — domain, schemas, server actions, queries.
  - Alternativa: extraer `format-currency` o helpers numéricos a `shared/lib/`.

## Cross-slice

`tier-memberships/` (slice separado, 1084 LOC bajo cap) importa tipos de `tiers/public.ts`. Boundary limpio. Sin solapamiento.

## Próximos pasos

Redactar plan completo. Empezar por trim; medir antes de decidir sub-split.

Cuando este plan se cierre, eliminar la entry `tiers` (temporal) del `WHITELIST` en `scripts/lint/check-slice-size.ts`.
