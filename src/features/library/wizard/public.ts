/**
 * API pública del sub-slice `library/wizard/`.
 *
 * Wizard 4-step para crear/editar categorías de biblioteca:
 * Identidad → Aporte → Lectura → Tipo (general/curso). Compone con el
 * primitive `<Wizard>` de shared.
 *
 * Boundary: cualquier consumer fuera de wizard/ (incluido el parent
 * `library/` raíz, siblings) importa SOLO desde acá. Internos usan
 * paths relativos.
 *
 * Plan: docs/plans/2026-05-04-library-root-sub-split-and-cap-enforcement.md
 * ADR:  docs/decisions/2026-05-04-library-root-sub-split.md
 */

export { CategoryFormSheet } from './ui/category-form-sheet'
export type { GroupOption, MemberOption, TierOption } from './ui/wizard/category-form-types'
