# Plan — Sub-split de `groups/` (placeholder)

**Fecha:** 2026-05-04 (placeholder)
**Estado:** Pendiente — audit completo, plan a redactar.
**ADR:** `docs/decisions/2026-05-04-library-root-sub-split.md` (decisión meta).

## Estado

Audit del slice realizado el 2026-05-04. Hallazgos:

- **LOC actual**: 2969 prod.
- **Sub-split propuesto** (4 sub-slices):
  - `groups/admin/` (~1150 LOC) — UI: group-detail-view, group-form-sheet, groups-list-admin, group-members-sheet, delete-group-confirm.
  - `groups/crud/` (~591 LOC) — actions: create-group, update-group, delete-group + queries compartidas.
  - `groups/memberships/` (~230 LOC) — actions: add-member-to-group, remove-member-from-group.
  - `groups/category-scope/` (~223 LOC) — set-group-category-scope action + category-scope-selector UI.
- **Raíz post-split**: ~700 LOC (domain/types, permissions enum, invariants, presets, schemas, queries read-side, primitives UI).

## Riesgo principal

Cross-slice consumers: `members/server/permissions.ts` (hasPermission), `library/admin` (GroupsScopeSheet), `places/server/actions.ts` (preset auto al crear place). Convención: consumers siempre via `@/features/groups/public` (raíz re-exporta).

## Próximos pasos

Redactar plan completo. Coordinar con plan tidy-stargazing-summit (G.7 permission groups cleanup) — ese plan toca actions que aquí se moverían.

Cuando este plan se cierre, eliminar la entry `groups` (temporal) del `WHITELIST` en `scripts/lint/check-slice-size.ts`.
