# Plan — Sub-split de `discussions/` (placeholder)

**Fecha:** 2026-05-04 (placeholder)
**Estado:** Pendiente — audit completo, plan a redactar.
**ADR:** `docs/decisions/2026-05-04-library-root-sub-split.md` (decisión meta).

## Estado

Audit del slice realizado el 2026-05-04. Hallazgos:

- **LOC actual**: 7362 prod + ~4800 tests.
- **Sub-split propuesto** (5 sub-slices verticales, orden por coupling creciente):
  - `discussions/rich-text/` (~433 LOC) — TipTap AST schemas + helpers numéricos. Orthogonal, cero dependencias internas. Reusable potencial.
  - `discussions/reactions/` (~222 LOC) — CRUD de reactions + aggregator. Trivial.
  - `discussions/presence/` (~470 LOC) — DwellTracker + ThreadPresence + PostRead + place-opening + use-comment-realtime.
  - `discussions/posts/` (~982 LOC) — Post CRUD (5 actions) + queries + slug.
  - `discussions/comments/` (~584 LOC) — Comment CRUD + quote validation. Depende de posts/ para findQuoteSource.
- **Raíz post-split**: ~900 LOC (domain/types, invariants, errors, schemas, actor, realtime broadcast, composers UI, admin menus, edit-window UI, reaction-bar, quote UI).

## Riesgo principal

Comments depende de Posts (quote validation contra `findQuoteSource`). Solución: comments importa Post types vía `@/features/discussions/public`; query helper queda en posts/.

## Próximos pasos

Redactar plan completo análogo a `2026-05-04-library-root-sub-split-and-cap-enforcement.md`:

1. Pre-cleanup (mover errors helper a raíz si aplica, convertir relative imports a absolute).
2. Crear `discussions/rich-text/` (mínimo coupling).
3. Crear `discussions/reactions/`.
4. Crear `discussions/presence/`.
5. Crear `discussions/posts/`.
6. Crear `discussions/comments/`.
7. Cierre: actualizar pages (`/conversations/[postSlug]`, `/library/[cat]/[item]` que renderiza CommentThread), eliminar entry de WHITELIST.

Cuando este plan se cierre, eliminar la entry `discussions` (temporal) del `WHITELIST` en `scripts/lint/check-slice-size.ts`.
