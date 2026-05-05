/**
 * Mapper de errores **inesperados** del slice `tiers` a copy amistoso.
 *
 * Los errores **esperados** del flujo (e.g. `tier_name_taken`) viajan
 * como discriminated union return — NO pasan por acá. El caller los
 * matchea con copy específico antes de delegar a este mapper.
 *
 * Los errores que SÍ caen acá son inesperados (auth fail, place
 * archivado, validación rota). Next 15 NO preserva las propiedades
 * custom de un Error tirado desde Server Action — sólo viaja `digest`
 * y un 500 opaco al cliente. Por eso `isDomainError(err)` típicamente
 * retorna `false` y caemos al copy de fallback. Eso es deliberado:
 * no merece la pena over-engineer mapping para casos que no deberían
 * ocurrir en un flujo normal del owner.
 */

import { isDomainError } from '@/shared/errors/domain-error'

export function friendlyTierErrorMessage(err: unknown): string {
  if (isDomainError(err)) {
    if (err.code === 'AUTHORIZATION') {
      return 'Solo el owner puede gestionar tiers.'
    }
    if (err.code === 'NOT_FOUND') {
      return 'El tier ya no existe o el place fue archivado.'
    }
    if (err.code === 'VALIDATION') {
      return err.message || 'Revisá los datos del formulario.'
    }
    return 'Algo no salió bien. Reintentá en un momento.'
  }
  return 'Algo no salió bien. Reintentá en un momento.'
}
