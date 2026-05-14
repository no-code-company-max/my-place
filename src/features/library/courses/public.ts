/**
 * API pública client-safe del sub-slice `library/courses`.
 *
 * Course flag + sequential unlock + completion tracking para categorías
 * `kind === 'COURSE'`.
 *
 * El sub-slice agrega:
 * - Helpers de permisos `canMarkItemCompleted` / `canOpenItem`.
 * - Validación de ciclos en prereqs (BFS app-layer, max depth 50).
 * - Server actions: `setItemPrereqAction`, `markItemCompletedAction`,
 *   `unmarkItemCompletedAction`.
 * - Schemas Zod para los inputs de las actions.
 *
 * Boundary: este sub-slice puede importar de `@/features/library/public`
 * (parent) y de cross-slices vía sus public.ts. NO puede importar
 * `@/features/library/access/*` directo (sibling internals — usar
 * `@/features/library/access/public`).
 *
 * Decisión: docs/decisions/2026-05-04-library-courses-and-read-access.md
 */

// ---------------------------------------------------------------
// Permissions — funciones puras reusables (UI + server)
// ---------------------------------------------------------------
export { canMarkItemCompleted, canOpenItem, type ItemForPrereqCheck } from './domain/permissions'

// ---------------------------------------------------------------
// Prereq cycle validation — pura, expuesta para tests + UI optimista
// ---------------------------------------------------------------
export {
  PREREQ_CHAIN_MAX_DEPTH,
  validateNoCycle,
  type ItemForCycleCheck,
} from './domain/prereq-validation'

// ---------------------------------------------------------------
// Schemas Zod
// ---------------------------------------------------------------
export {
  markItemCompletedInputSchema,
  setItemPrereqInputSchema,
  unmarkItemCompletedInputSchema,
  type MarkItemCompletedInput,
  type SetItemPrereqInput,
  type UnmarkItemCompletedInput,
} from './schemas'

// ---------------------------------------------------------------
// Server Actions (referencias serializadas viajan client-safe)
// ---------------------------------------------------------------
export {
  markItemCompletedAction,
  type MarkItemCompletedResult,
} from './server/actions/mark-item-completed'
export { setItemPrereqAction, type SetItemPrereqResult } from './server/actions/set-item-prereq'
export {
  unmarkItemCompletedAction,
  type UnmarkItemCompletedResult,
} from './server/actions/unmark-item-completed'

// ---------------------------------------------------------------
// UI components
// ---------------------------------------------------------------
export { CourseItemList } from './ui/course-item-list'
export { LibraryItemLockedRow } from './ui/library-item-locked-row'
export { MarkCompleteButton } from './ui/mark-complete-button'
export { PrereqLockBadge } from './ui/prereq-lock-badge'
export { PrereqSelector } from './ui/prereq-selector'
export { PrereqToggleSelector } from './ui/prereq-toggle-selector'
