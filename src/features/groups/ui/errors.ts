/**
 * Mapper de errores **inesperados** del slice `groups` a copy amistoso.
 *
 * Los errores **esperados** del flujo (`group_name_taken`,
 * `permission_invalid`, `cannot_modify_preset`, `cannot_delete_preset`,
 * `group_has_members`, `target_user_not_member`, `target_is_owner`,
 * `already_in_group`, `not_in_group`, `category_not_in_place`,
 * `cannot_scope_preset`) viajan como discriminated union return — NO
 * pasan por acá. El caller los matchea con copy específico antes de
 * delegar a este mapper.
 *
 * Los errores que SÍ caen acá son inesperados (auth fail, place
 * archivado, validación rota). Next 15 NO preserva las propiedades
 * custom de un Error tirado desde Server Action — sólo viaja `digest`
 * y un 500 opaco. Por eso `isDomainError` típicamente retorna `false`
 * y caemos al copy de fallback.
 */

import { isDomainError } from '@/shared/errors/domain-error'

export function friendlyGroupErrorMessage(err: unknown): string {
  if (isDomainError(err)) {
    if (err.code === 'AUTHORIZATION') {
      return 'Solo el owner puede gestionar grupos.'
    }
    if (err.code === 'NOT_FOUND') {
      return 'No encontramos el grupo. Refrescá la page.'
    }
    if (err.code === 'VALIDATION') {
      return err.message || 'Revisá los datos del formulario.'
    }
    return 'Algo no salió bien. Reintentá en un momento.'
  }
  return 'Algo no salió bien. Reintentá en un momento.'
}
