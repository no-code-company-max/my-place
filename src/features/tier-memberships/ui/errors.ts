/**
 * Mapper de errores **inesperados** del slice `tier-memberships` a copy
 * amistoso.
 *
 * Los errores **esperados** del flujo (`tier_not_published`,
 * `tier_already_assigned`, `target_user_not_member`, `assignment_not_found`)
 * viajan como discriminated union return — NO pasan por acá. El caller los
 * matchea con copy específico antes de delegar a este mapper.
 *
 * Los errores que SÍ caen acá son inesperados (auth fail, place archivado,
 * validación rota). Next 15 NO preserva las propiedades custom de un Error
 * tirado desde Server Action — sólo viaja `digest` y un 500 opaco. Por eso
 * `isDomainError` típicamente retorna `false` y caemos al copy de fallback.
 */

import { isDomainError } from '@/shared/errors/domain-error'

export function friendlyTierMembershipErrorMessage(err: unknown): string {
  if (isDomainError(err)) {
    if (err.code === 'AUTHORIZATION') {
      return 'Solo el owner puede gestionar las asignaciones de tier.'
    }
    if (err.code === 'NOT_FOUND') {
      return 'No encontramos el tier o la asignación. Refrescá la page.'
    }
    if (err.code === 'VALIDATION') {
      return err.message || 'Revisá los datos del formulario.'
    }
    return 'Algo no salió bien. Reintentá en un momento.'
  }
  return 'Algo no salió bien. Reintentá en un momento.'
}
