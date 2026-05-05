/**
 * Permisos del slice `library` — funciones puras.
 *
 * Replican la matriz de § 11 de la spec. Se usan en:
 *   - Server actions (gate antes del INSERT/UPDATE).
 *   - UI condicional (botones visibles/ocultos según viewer).
 *   - Tests unit.
 *
 * La RLS (migration 20260430000000) replica la lógica a nivel SQL —
 * estas funciones son la fuente canónica del lado app.
 *
 * Ver `docs/features/library/spec.md` § 11.
 */

import type { ContributionPolicy } from './types'

/**
 * Viewer mínimo para evaluar permisos. Lo provee `resolveLibraryViewer`
 * en `library/server/viewer.ts` (cacheable React.cache por request).
 *
 * - `userId`: actor del request (siempre poblado, RouteAuthError 401 sino).
 * - `isAdmin`: derivado de `findIsPlaceAdmin` (membership al preset
 *   "Administradores" del place; ver ADR `2026-05-03-drop-membership-role-rls-impact.md`).
 *   También true si owner (consistente con el patrón established del slice).
 * - `isOwner`: `PlaceOwnership` activa para este user en el place. Owner
 *   bypassa la mayoría de gates (ver ADR `2026-05-04-library-courses-and-read-access.md` § decisión #C).
 * - `groupIds`: ids de `PermissionGroup` del que el user es miembro en el
 *   place (incluye preset + grupos custom). Usado por `canCreateInCategory`
 *   con policy=SELECTED_GROUPS y por `canReadCategory` con kind=GROUPS.
 * - `tierIds`: ids de `Tier` con `TierMembership` activa (no expirada) del
 *   user en el place. Usado por `canReadCategory` con kind=TIERS.
 *
 * `ReadonlyArray` para evitar mutación accidental que invalide invariantes.
 */
export type LibraryViewer = {
  userId: string
  isAdmin: boolean
  isOwner: boolean
  groupIds: ReadonlyArray<string>
  tierIds: ReadonlyArray<string>
}

export type CategoryForPermissions = {
  contributionPolicy: ContributionPolicy
  /** Lista de userIds designated. Se popula solo cuando policy=DESIGNATED;
   *  para otras policies el caller puede pasar [] sin importar. */
  designatedUserIds: ReadonlyArray<string>
  /** Lista de groupIds asignados al scope SELECTED_GROUPS. Se popula sólo
   *  cuando policy=SELECTED_GROUPS; para otras policies el caller puede
   *  pasar [] sin importar. Match con `viewer.groupIds` en `canCreateInCategory`. */
  groupScopeIds?: ReadonlyArray<string>
}

/**
 * ¿Puede el viewer crear un item en esta categoría?
 *
 * - admin/owner: siempre
 * - policy=DESIGNATED: admin o miembro listado
 * - policy=MEMBERS_OPEN: cualquier miembro activo (asumido por el
 *   caller — la membership ya fue verificada por `resolveActorForPlace`)
 * - policy=SELECTED_GROUPS: la evaluación NO se hace acá — vive en los
 *   sub-slices `library/contributors/` (group scope check). Default
 *   cerrado: si el caller no pasó la lógica de grupos, este helper
 *   retorna false.
 *
 * `ADMIN_ONLY` fue eliminado (migration 20260504010000) — ver ADR
 * `2026-05-04-library-contribution-policy-groups.md`.
 */
export function canCreateInCategory(
  category: CategoryForPermissions,
  viewer: LibraryViewer,
): boolean {
  if (viewer.isAdmin) return true
  switch (category.contributionPolicy) {
    case 'DESIGNATED':
      return category.designatedUserIds.includes(viewer.userId)
    case 'MEMBERS_OPEN':
      return true
    case 'SELECTED_GROUPS':
      // Evaluado en `library/contributors/` con el group scope. Default
      // cerrado acá si el caller no enriqueció la decisión.
      return false
  }
}

/**
 * ¿Puede el viewer editar/archivar la categoría?
 *
 * Solo admin/owner. Author no aplica (las categorías no tienen author —
 * son decisión del admin, decisión user 2026-04-30).
 */
export function canEditCategory(viewer: LibraryViewer): boolean {
  return viewer.isAdmin
}

/**
 * ¿Puede el viewer editar el item?
 *
 * R.7.6+: admin/owner o author del item (Post.authorUserId === viewer.userId).
 * En R.7.2 no hay items todavía — la función vive acá para preservar la
 * superficie pública del slice.
 */
export function canEditItem(item: { authorUserId: string | null }, viewer: LibraryViewer): boolean {
  if (viewer.isAdmin) return true
  return item.authorUserId === viewer.userId
}

/** Mismo modelo que `canEditItem`. */
export function canArchiveItem(
  item: { authorUserId: string | null },
  viewer: LibraryViewer,
): boolean {
  return canEditItem(item, viewer)
}
