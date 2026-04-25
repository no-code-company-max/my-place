/**
 * Mapper de errores de dominio del slice events a copy amistoso en español.
 * Mismo patrón que `discussions/ui/utils.ts:friendlyErrorMessage`.
 */

import {
  AuthorizationError,
  ConflictError,
  NotFoundError,
  OutOfHoursError,
  ValidationError,
  isDomainError,
} from '@/shared/errors/domain-error'

export function friendlyEventErrorMessage(err: unknown): string {
  if (err instanceof OutOfHoursError) return 'El place está cerrado ahora.'
  if (err instanceof AuthorizationError) return 'No tenés permiso para hacer esto.'
  if (err instanceof ValidationError) return 'Revisá los datos del formulario.'
  if (err instanceof ConflictError)
    return 'Conflicto: el evento puede estar cancelado o haber cambiado.'
  if (err instanceof NotFoundError) return 'Este evento ya no está disponible.'
  if (isDomainError(err)) return 'Algo no salió bien. Reintentá en un momento.'
  return 'Algo no salió bien. Reintentá en un momento.'
}
