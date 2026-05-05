/**
 * API pública del sub-slice `library/contributors/`.
 *
 * Gestión de personas asignadas a categorías:
 *  - Designated contributors (policy DESIGNATED).
 *  - Group scope (policy SELECTED_GROUPS).
 *
 * UI sheets + Server Actions de invite/remove/set-group-scope/set-designated.
 *
 * Boundary: cualquier consumer fuera de contributors/ importa SOLO desde acá.
 *
 * Plan: docs/plans/2026-05-04-library-root-sub-split-and-cap-enforcement.md
 * ADR:  docs/decisions/2026-05-04-library-root-sub-split.md
 */

// ---------------------------------------------------------------
// UI components
// ---------------------------------------------------------------

export { ContributorsSheet } from './ui/contributors-sheet'
export { GroupsScopeSheet } from './ui/groups-scope-sheet'

// ---------------------------------------------------------------
// Server Actions
// ---------------------------------------------------------------

export { inviteContributorAction } from './server/actions/invite-contributor'
export { removeContributorAction } from './server/actions/remove-contributor'
export {
  setLibraryCategoryGroupScopeAction,
  type SetLibraryCategoryGroupScopeResult,
} from './server/actions/set-category-group-scope'
export {
  setLibraryCategoryDesignatedContributorsAction,
  type SetLibraryCategoryDesignatedContributorsResult,
} from './server/actions/set-designated-contributors'
