/**
 * Permisos del sub-slice `library/access` — funciones puras.
 *
 * Define `canReadCategory` y `canReadItem`: gate de LECTURA de contenido
 * (vs `canCreateInCategory` del slice raíz, gate de ESCRITURA).
 *
 * La regla canónica del ADR `2026-05-04-library-courses-and-read-access.md`:
 *  - Owner SIEMPRE lee (decisión #C, owner-bypass first).
 *  - `readAccessKind === 'PUBLIC'` → cualquier miembro activo lee.
 *  - `readAccessKind === 'GROUPS'` → matching `viewer.groupIds` ∩ `groupReadIds`.
 *  - `readAccessKind === 'TIERS'`  → matching `viewer.tierIds` ∩ `tierReadIds`.
 *  - `readAccessKind === 'USERS'`  → `viewer.userId` ∈ `userReadIds`.
 *
 * NOTA importante: a diferencia de `canCreateInCategory`, **admin no
 * bypassa lectura**. Sólo el owner. Razón: la categoría puede ser explícita
 * de un grupo/tier/user puntual y queremos que el modelo refleje eso —
 * un admin "general" no debe ver consultoría privada para X. El owner
 * mantiene el bypass por su rol fundacional.
 *
 * Las categorías SIEMPRE se listan para todos los miembros activos (el
 * admin de la library no oculta categorías a las que el viewer no tiene
 * read access — sólo se gatea ABRIR el item). Estas funciones se invocan
 * en la page del item / detalle del item.
 *
 * Ver `docs/decisions/2026-05-04-library-courses-and-read-access.md`.
 */

import type { LibraryReadAccessKind, LibraryViewer } from '@/features/library/public'

/**
 * Contexto de lectura de una categoría — datos necesarios para evaluar
 * `canReadCategory`. Lo provee `findReadScope(categoryId)` (queries del
 * sub-slice) más el `readAccessKind` que vive en `LibraryCategory`.
 *
 * Cuando `readAccessKind === 'PUBLIC'` los 3 arrays se ignoran (pueden
 * estar vacíos sin afectar el resultado).
 */
export type CategoryReadContext = {
  readAccessKind: LibraryReadAccessKind
  /** IDs de `PermissionGroup` con read scope. Aplica sólo si kind=GROUPS. */
  groupReadIds: ReadonlyArray<string>
  /** IDs de `Tier` con read scope. Aplica sólo si kind=TIERS. */
  tierReadIds: ReadonlyArray<string>
  /** IDs de `User` con read scope. Aplica sólo si kind=USERS. */
  userReadIds: ReadonlyArray<string>
}

/**
 * ¿Puede el viewer leer/abrir items de esta categoría?
 *
 * - Owner: siempre (decisión #C ADR 2026-05-04).
 * - PUBLIC: siempre (default abierto).
 * - GROUPS: matching de `viewer.groupIds` con `groupReadIds`. Si ambos
 *   sets están vacíos → false (default cerrado, salvo owner).
 * - TIERS: idem con `tierIds`/`tierReadIds`.
 * - USERS: `viewer.userId` ∈ `userReadIds`.
 *
 * NO se invoca para listar categorías en la grilla — el listing es plano
 * para todos. Se invoca en la page de la categoría / detail del item.
 */
export function canReadCategory(category: CategoryReadContext, viewer: LibraryViewer): boolean {
  if (viewer.isOwner) return true
  switch (category.readAccessKind) {
    case 'PUBLIC':
      return true
    case 'GROUPS':
      return viewer.groupIds.some((g) => category.groupReadIds.includes(g))
    case 'TIERS':
      return viewer.tierIds.some((t) => category.tierReadIds.includes(t))
    case 'USERS':
      return category.userReadIds.includes(viewer.userId)
    default: {
      // Exhaustiveness check — si se agrega un kind nuevo al enum sin
      // cubrirlo acá, TS rompe el build en compile time.
      const _exhaustive: never = category.readAccessKind
      return _exhaustive
    }
  }
}

/**
 * ¿Puede el viewer leer/abrir el item?
 *
 * Delega en `canReadCategory` — la decisión de "puede ver el contenido"
 * vive a nivel categoría según el ADR. No hay override por item.
 *
 * El parámetro `item` se acepta por simetría con `canEditItem`/
 * `canArchiveItem` y para futuros checks por-item (e.g. published flag),
 * pero hoy es ignorado en la decisión.
 */
export function canReadItem(
  _item: { categoryId: string },
  category: CategoryReadContext,
  viewer: LibraryViewer,
): boolean {
  return canReadCategory(category, viewer)
}
