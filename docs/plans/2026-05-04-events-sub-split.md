# Plan — Sub-split de `events/` (placeholder)

**Fecha:** 2026-05-04 (placeholder)
**Estado:** Pendiente — audit completo, plan a redactar.
**ADR:** `docs/decisions/2026-05-04-library-root-sub-split.md` (decisión meta).

## Estado

Audit del slice realizado el 2026-05-04. Hallazgos:

- **LOC actual**: 2532 prod.
- **Sub-split propuesto** (3 sub-slices):
  - `events/rsvp/` (~355 LOC) — rsvp-button + attendee-avatars + rsvp action.
  - `events/calendar/` (~491 LOC) — event-list + event-list-item + event-date-tile + format-event-time + listEvents query.
  - `events/editor/` (~417 LOC) — event-form + create + update actions.
- **Raíz post-split**: ~1150 LOC (domain, schemas, getEventDetail query, cancel actions, event-metadata-header, event-actions-menu, event-cancelled-badge).

## Riesgo principal

Pattern "evento ES thread" — events depende de discussions (Post backpointer + redirect a `/conversations/[postSlug]`). Cross-zona redirect debe seguir funcionando post-split.

## Próximos pasos

Redactar plan completo. `format-event-time.ts` (170 LOC) candidato a evaluación: ¿debería estar en `shared/lib/time.ts` (agnóstico al dominio events)?

Cuando este plan se cierre, eliminar la entry `events` (temporal) del `WHITELIST` en `scripts/lint/check-slice-size.ts`.
