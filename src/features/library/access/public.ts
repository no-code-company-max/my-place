/**
 * API pública client-safe del sub-slice `library/access`.
 *
 * Read access scopes para categorías de la library — controla quién puede
 * VER el contenido (vs `library` raíz que tiene contribution policy = quién
 * puede CREAR contenido).
 *
 * El sub-slice agrega:
 * - 3 tablas de scope (groups | tiers | users) por categoría.
 * - Helpers de permisos `canReadCategory` / `canReadItem`.
 * - Server action `setLibraryCategoryReadScopeAction` (override completo).
 * - UI del step 3 del wizard de categoría + view "access denied" inline
 *   (G.5+6.b / G.2+3.b — populates UI exports en fases siguientes).
 *
 * Boundary: este sub-slice puede importar de `@/features/library/public`
 * (parent) y de cross-slices vía sus public.ts. NO puede importar
 * `@/features/library/courses/*` directo (sibling internals — usar
 * `@/features/library/courses/public`).
 *
 * Decisión: docs/decisions/2026-05-04-library-courses-and-read-access.md
 */

// ---------------------------------------------------------------
// Domain — permisos puros (server + client safe)
// ---------------------------------------------------------------

export { canReadCategory, canReadItem, type CategoryReadContext } from './domain/permissions'

// ---------------------------------------------------------------
// Schemas Zod — input del action (también usable cliente-side para
// validar formularios antes del submit).
// ---------------------------------------------------------------

export {
  setLibraryCategoryReadScopeInputSchema,
  type SetLibraryCategoryReadScopeInput,
} from './schemas'

// ---------------------------------------------------------------
// Server actions — referencias `'use server'` viajan client-safe
// ---------------------------------------------------------------

export {
  setLibraryCategoryReadScopeAction,
  type SetLibraryCategoryReadScopeResult,
} from './server/actions/set-read-scope'

// ---------------------------------------------------------------
// UI components
// ---------------------------------------------------------------

export { ItemAccessDeniedView } from './ui/item-access-denied-view'
