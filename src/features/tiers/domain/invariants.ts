/** Invariantes puros del slice tiers. Spec § 8 + § 9. */

import { ValidationError } from '@/shared/errors/domain-error'
import { TIER_CURRENCY_VALUES, TIER_DURATION_VALUES, TIER_VISIBILITY_VALUES } from './types'
import type { TierCurrency, TierDuration, TierVisibility } from './types'

// ---------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------

export const TIER_NAME_MIN_LENGTH = 1
export const TIER_NAME_MAX_LENGTH = 60
export const TIER_DESCRIPTION_MAX_LENGTH = 280
export const TIER_PRICE_CENTS_MIN = 0
/** Cap defensivo $9,999.99. Stripe Connect permitirá subir el cap. */
export const TIER_PRICE_CENTS_MAX = 999_999

// ---------------------------------------------------------------
// Validators
// ---------------------------------------------------------------

export function validateTierName(name: string): void {
  const trimmed = name.trim()
  if (trimmed.length < TIER_NAME_MIN_LENGTH) {
    throw new ValidationError('El nombre del tier no puede estar vacío.', {
      length: trimmed.length,
    })
  }
  if (trimmed.length > TIER_NAME_MAX_LENGTH) {
    throw new ValidationError(`El nombre no puede superar ${TIER_NAME_MAX_LENGTH} caracteres.`, {
      length: trimmed.length,
    })
  }
}

export function validateTierDescription(description: string | null | undefined): void {
  if (description === null || description === undefined) return
  const trimmed = description.trim()
  if (trimmed.length === 0) return
  if (trimmed.length > TIER_DESCRIPTION_MAX_LENGTH) {
    throw new ValidationError(
      `La descripción no puede superar ${TIER_DESCRIPTION_MAX_LENGTH} caracteres.`,
      { length: trimmed.length },
    )
  }
}

export function validateTierPriceCents(priceCents: number): void {
  if (!Number.isInteger(priceCents)) {
    throw new ValidationError('El precio debe ser un entero (centavos).', { priceCents })
  }
  if (priceCents < TIER_PRICE_CENTS_MIN) {
    throw new ValidationError('El precio no puede ser negativo.', { priceCents })
  }
  if (priceCents > TIER_PRICE_CENTS_MAX) {
    throw new ValidationError(
      `El precio no puede superar ${TIER_PRICE_CENTS_MAX} centavos ($${(TIER_PRICE_CENTS_MAX / 100).toFixed(2)}).`,
      { priceCents },
    )
  }
}

export function validateTierCurrency(currency: string): asserts currency is TierCurrency {
  if (!TIER_CURRENCY_VALUES.includes(currency as TierCurrency)) {
    throw new ValidationError('Moneda no soportada.', {
      currency,
      supported: TIER_CURRENCY_VALUES,
    })
  }
}

export function validateTierDuration(duration: string): asserts duration is TierDuration {
  if (!TIER_DURATION_VALUES.includes(duration as TierDuration)) {
    throw new ValidationError('Duración inválida.', {
      duration,
      supported: TIER_DURATION_VALUES,
    })
  }
}

export function validateTierVisibility(visibility: string): asserts visibility is TierVisibility {
  if (!TIER_VISIBILITY_VALUES.includes(visibility as TierVisibility)) {
    throw new ValidationError('Visibilidad inválida.', {
      visibility,
      supported: TIER_VISIBILITY_VALUES,
    })
  }
}
