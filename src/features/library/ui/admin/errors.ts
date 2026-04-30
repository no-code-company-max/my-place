/**
 * Mapper de errores de dominio del slice library a copy amistoso en
 * español. Mismo patrón que `events/ui/errors.ts` y
 * `discussions/ui/utils.ts`.
 */

import {
  AuthorizationError,
  ConflictError,
  NotFoundError,
  ValidationError,
  isDomainError,
} from '@/shared/errors/domain-error'

export function friendlyLibraryErrorMessage(err: unknown): string {
  if (err instanceof AuthorizationError) {
    return 'No tenés permiso para hacer esto.'
  }
  if (err instanceof NotFoundError) {
    return 'La categoría ya no existe o fue archivada.'
  }
  if (err instanceof ValidationError) {
    return err.message || 'Revisá los datos del formulario.'
  }
  if (err instanceof ConflictError) {
    return 'Algo cambió mientras editabas. Recargá la página.'
  }
  if (isDomainError(err)) {
    if (err.code === 'LIBRARY_CATEGORY_LIMIT_REACHED') {
      return 'Tu biblioteca llegó al máximo de categorías. Archivá alguna antes de crear una nueva.'
    }
    if (err.code === 'LIBRARY_CATEGORY_SLUG_COLLISION') {
      return 'No se pudo generar un slug único. Probá un título distinto.'
    }
    return 'Algo no salió bien. Reintentá en un momento.'
  }
  return 'Algo no salió bien. Reintentá en un momento.'
}
