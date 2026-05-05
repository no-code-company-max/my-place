/**
 * Tipos del dominio del slice `groups` (G.2).
 *
 * Tipos planos serializables — sin instancias de Prisma. Las queries en
 * `server/queries.ts` mapean los rows de Prisma a estos shapes antes de
 * exponerlos. Lo que viaja al bundle cliente vive acá (importado desde
 * `public.ts`).
 *
 * Ver `docs/features/groups/spec.md` § 2 + § 9.
 */

import type { Permission } from './permissions'

/**
 * Grupo de permisos full hidratado. Lo consume la page de admin
 * (`/settings/groups`) y los dialogs.
 */
export type PermissionGroup = {
  id: string
  placeId: string
  name: string
  description: string | null
  permissions: Permission[]
  /** `true` si es el grupo preset hardcoded (`ADMIN_PRESET_NAME`). */
  isPreset: boolean
  /** Total de miembros activos en el grupo (precomputado por la query). */
  memberCount: number
  /**
   * IDs de categorías de library scopadas. Lista vacía → permisos
   * library:* del grupo aplican a TODAS las categorías del place.
   */
  categoryScopeIds: string[]
  createdAt: Date
  updatedAt: Date
}

/**
 * Resumen liviano para pintar la pertenencia de un user en
 * `<MemberGroupsControl>` (no necesita permissions ni scope detallado).
 */
export type GroupSummary = {
  id: string
  name: string
  isPreset: boolean
}

/**
 * Una asignación user ↔ group. Útil para listar a quién pertenece el
 * grupo (`<GroupMembersSheet>`).
 */
export type GroupMembership = {
  id: string
  groupId: string
  userId: string
  placeId: string
  addedAt: Date
  addedByUserId: string | null
  user: {
    displayName: string
    handle: string | null
    avatarUrl: string | null
  }
}
