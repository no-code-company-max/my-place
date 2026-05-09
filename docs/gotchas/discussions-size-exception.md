# Excepción autorizada al cap de 1500 líneas en `features/discussions`

El slice `discussions` supera el cap por la densidad inherente del dominio (6 entidades + TipTap AST).

Rationale y puntos de revisión (C.F, C.G, posible split de `flags/`) en `docs/decisions/2026-04-20-discussions-size-exception.md`.

**Importante:** la excepción **no aplica a otros slices** sin su propio registro en `docs/decisions/`. Si otro slice empieza a presionar el cap, abrir un ADR específico antes de extender.
