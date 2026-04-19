/**
 * Jerarquía de errores de dominio tipados.
 *
 * Los invariantes de `docs/data-model.md` (max 150 miembros, min 1 owner, slug inmutable,
 * etc.) se expresan como subclases específicas de `InvariantViolation` en cada feature.
 *
 * Uso: nunca lanzar `new Error(...)` desde domain services. Siempre una subclase de DomainError
 * para poder discriminar en logging, mapeo a HTTP, y feedback al usuario.
 */
export type DomainErrorCode =
  | 'INVARIANT_VIOLATION'
  | 'AUTHORIZATION'
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'CONFLICT'

export abstract class DomainError extends Error {
  abstract readonly code: DomainErrorCode

  constructor(
    message: string,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message)
    this.name = this.constructor.name
  }
}

/** Un invariante del dominio fue violado. Ej: sumar el miembro 151, quedar sin owner. */
export class InvariantViolation extends DomainError {
  readonly code = 'INVARIANT_VIOLATION' as const
}

/** El actor no tiene permisos para la operación. */
export class AuthorizationError extends DomainError {
  readonly code = 'AUTHORIZATION' as const
}

/** Recurso no encontrado. */
export class NotFoundError extends DomainError {
  readonly code = 'NOT_FOUND' as const
}

/** Input inválido (formato, tipo). Típicamente viene de Zod. */
export class ValidationError extends DomainError {
  readonly code = 'VALIDATION' as const
}

/** Conflicto de concurrencia o estado. Ej: slug duplicado, racing conditions. */
export class ConflictError extends DomainError {
  readonly code = 'CONFLICT' as const
}

export function isDomainError(err: unknown): err is DomainError {
  return err instanceof DomainError
}
