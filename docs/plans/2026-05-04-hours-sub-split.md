# Plan — Sub-split de `hours/` (placeholder)

**Fecha:** 2026-05-04 (placeholder)
**Estado:** Pendiente — audit completo, plan a redactar.
**ADR:** `docs/decisions/2026-05-04-library-root-sub-split.md` (decisión meta).

## Estado

Audit del slice realizado el 2026-05-04. Hallazgos:

- **LOC actual**: 2251 prod.
- **Sub-split propuesto** (2 sub-slices, decisión owner contra recomendación inicial del agent):
  - `hours/admin/` (~1313 LOC) — hours-form + week-editor + week-editor-day-row + week-editor-window-sheet + exceptions-editor.
  - `hours/member/` (~211 LOC) — place-closed-view + hours-preview.
- **Raíz post-split**: ~727 LOC (domain/types, invariants, timezones, schemas, server actions+queries, format-time helper).

## Riesgo principal

Gate vive a nivel del place layout (`[placeSlug]/(gated)/layout.tsx`) — consume `isPlaceOpen` + `PlaceClosedView`. Post-split, layout importa de `@/features/hours/public` (raíz re-exporta `isPlaceOpen` de raíz, `PlaceClosedView` de member sub-slice). Cross-slice: `events`, `discussions` consumen helpers temporal de hours.

## Próximos pasos

Redactar plan completo. Considerar también: `format-time.ts` y helpers Temporal son candidatos a `shared/lib/time.ts` (agnóstico al dominio hours).

Cuando este plan se cierre, eliminar la entry `hours` (temporal) del `WHITELIST` en `scripts/lint/check-slice-size.ts`.
