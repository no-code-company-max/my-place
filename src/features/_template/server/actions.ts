'use server'

import { templateCreateSchema, type TemplateCreateInput } from '../schemas'
import { assertTemplateInvariant } from '../domain/invariants'
import { logger } from '@/shared/lib/logger'
import { ValidationError } from '@/shared/errors/domain-error'

/**
 * Server actions del slice. Puerta de entrada write-side.
 *
 * Pipeline estándar:
 * 1. Validar input con Zod (ValidationError si falla)
 * 2. Chequear permisos (AuthorizationError si no)
 * 3. Chequear invariantes del dominio (InvariantViolation si no)
 * 4. Escribir en DB (queries.ts)
 * 5. Revalidar cache si aplica
 */

export async function createTemplate(input: unknown): Promise<void> {
  const parsed = templateCreateSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationError('Input inválido', { issues: parsed.error.issues })
  }

  const data: TemplateCreateInput = parsed.data
  assertTemplateInvariant(data)

  logger.debug({ data }, 'createTemplate')
}
