# Tests E2E/RLS corren contra `my-place` Cloud (mismo DB que dev) — prefijos reservados

**Prefijos:** `usr_e2e_*` / `place_e2e_*` / emails `/^e2e-.*@e2e\.place\.local$/`.

El seed `tests/fixtures/e2e-seed.ts` es aditivo y wipe FK-safe **sólo** de IDs con prefijo E2E. Crear data manual con esos prefijos pisa el seed.

Helper `resetContent(placeKey)` tiene guard defensivo: throw si el `placeId` no matchea `/^place_e2e_/`.

Dev place `the-company` queda intocado entre runs.

Ver ADR `docs/decisions/2026-04-22-e2e-rls-testing-cloud-branches.md`.
