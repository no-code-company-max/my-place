/**
 * Helpers del grupo preset hardcoded "Administradores" (G.2).
 *
 * El preset se autogenera por place (ver `migrate-admins-to-groups.ts`
 * + extensión a `createPlaceAction`). Tiene `isPreset=true` y NO se
 * puede:
 *  - eliminar (`deleteGroupAction` → `cannot_delete_preset`)
 *  - cambiar permisos (`updateGroupAction` → `cannot_modify_preset`)
 *  - scopear a categorías (`setGroupCategoryScopeAction` →
 *    `cannot_scope_preset`)
 *
 * SI se permite cambiar nombre/descripción del preset (decisión: el
 * owner puede preferir "Equipo de moderación" en lugar de
 * "Administradores"). Y SI se permite asignar/remover miembros.
 *
 * Ver `docs/features/groups/spec.md` § 4 + § 8.
 */

import { ADMIN_PRESET_NAME, PERMISSIONS_ALL, type Permission } from './permissions'

/**
 * Devuelve la lista exacta de permisos que recibe el preset al crearse.
 * En v1 == `PERMISSIONS_ALL`. Si el ADR hardcodea cambios futuros (un
 * permiso que NO debería estar en el preset), se ajusta acá.
 */
export function presetPermissions(): Permission[] {
  return [...PERMISSIONS_ALL]
}

/**
 * `true` si la row pasada corresponde al grupo preset hardcoded. Acepta
 * tanto el shape full (con `isPreset` y `name`) como el shape mínimo
 * (sólo `isPreset`). El `name` se chequea como defensa adicional pero
 * NO es estrictamente necesario una vez que la fila tiene `isPreset=true`.
 */
export function isAdminPreset(group: { isPreset: boolean; name?: string }): boolean {
  if (!group.isPreset) return false
  if (group.name !== undefined && group.name !== ADMIN_PRESET_NAME) {
    // Caso muy improbable: alguien renombró el preset a algo que no es
    // "Administradores" Y mantuvo isPreset=true. Lo seguimos tratando
    // como preset porque el flag DB es la fuente de verdad — el name
    // es metadata mutable.
  }
  return true
}
