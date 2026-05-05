/**
 * API pública del sub-slice `library/admin/`.
 *
 * UI principal de admin (CategoryListAdmin) + actions CRUD básicas
 * de category (create/update/archive/reorder).
 *
 * El form sheet completo (wizard 4-step) vive en `library/wizard/`
 * y la gestión de personas asignadas (designated contributors +
 * group scope sheets + actions) en `library/contributors/`. Esta
 * separación mantiene cada sub-slice bajo el cap 1500 LOC.
 *
 * Boundary: cualquier consumer fuera de admin/ importa SOLO desde acá.
 *
 * Plan: docs/plans/2026-05-04-library-root-sub-split-and-cap-enforcement.md
 * ADR:  docs/decisions/2026-05-04-library-root-sub-split.md
 */

// ---------------------------------------------------------------
// UI components — settings/library
// ---------------------------------------------------------------

export { CategoryListAdmin } from './ui/category-list-admin'
export {
  contributionPolicyDescription,
  contributionPolicyLabel,
} from './ui/contribution-policy-label'

// ---------------------------------------------------------------
// Server Actions — CRUD básico de category
// ---------------------------------------------------------------

export { archiveLibraryCategoryAction } from './server/actions/archive-category'
export { createLibraryCategoryAction } from './server/actions/create-category'
export { reorderLibraryCategoriesAction } from './server/actions/reorder-categories'
export { updateLibraryCategoryAction } from './server/actions/update-category'
