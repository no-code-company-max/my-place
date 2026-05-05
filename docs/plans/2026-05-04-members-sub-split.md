# Plan — Sub-split de `members/` (placeholder)

**Fecha:** 2026-05-04 (placeholder)
**Estado:** Pendiente — audit completo, plan a redactar.
**ADR:** `docs/decisions/2026-05-04-library-root-sub-split.md` (decisión meta).

## Estado

Audit del slice realizado el 2026-05-04. Hallazgos:

- **LOC actual**: 4490 prod + ~2800 tests.
- **Sub-split propuesto** (5 sub-slices verticales):
  - `members/invitations/` (~550 LOC) — invite/resend/accept actions + email Resend + UI forms.
  - `members/moderation/` (~550 LOC) — block/unblock/expel actions + dialogs UI.
  - `members/directory/` (~400 LOC) — directory-queries + filtros (group/tier/joinedSince).
  - `members/profile/` (~350 LOC) — queries de perfil + leave UI.
  - `members/erasure/` (~423 LOC) — job 365d (advisory lock, batch 500).
- **Raíz post-split**: ~1100 LOC (types, schemas, queries core, permissions, UI primitives, ownership UI).

## Riesgo principal

`accept.ts` crea Membership y PlaceOwnership en tx — acoplado con `leave.ts` (rollback flow). Cross-slice consumers (`discussions`, `library`, `groups`, `events`) usan `MemberAvatar`, `hasPermission`, `searchMembers`.

## Próximos pasos

Redactar plan completo. Orden por coupling creciente: invitations → moderation → directory → profile → erasure.

Cuando este plan se cierre, eliminar la entry `members` (temporal) del `WHITELIST` en `scripts/lint/check-slice-size.ts`.
