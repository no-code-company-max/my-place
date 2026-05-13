/**
 * Permisos del slice `library` — funciones puras.
 *
 * Replican la matriz de § 11 de la spec. Se usan en:
 *   - Server actions (gate antes del INSERT/UPDATE).
 *   - UI condicional (botones visibles/ocultos según viewer).
 *   - Tests unit.
 *
 * **2026-05-13 (S1b):** `canCreateInCategory` se removió. El gate de
 * creación vive ahora en `canWriteCategory` del sub-slice
 * `library/contribution/`. Ver ADR
 * `2026-05-12-library-permissions-model.md`.
 *
 * Ver `docs/features/library/spec.md` § 11.
 */

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
 *   place (incluye preset + grupos custom). Usado por `canWriteCategory`
 *   con kind=GROUPS y por `canReadCategory` con kind=GROUPS.
 * - `tierIds`: ids de `Tier` con `TierMembership` activa (no expirada) del
 *   user en el place. Usado por `canReadCategory`/`canWriteCategory` con
 *   kind=TIERS.
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
