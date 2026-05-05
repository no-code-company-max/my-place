import { describe, expect, it } from 'vitest'
import { ValidationError } from '@/shared/errors/domain-error'
import {
  TIER_DESCRIPTION_MAX_LENGTH,
  TIER_NAME_MAX_LENGTH,
  TIER_PRICE_CENTS_MAX,
  validateTierCurrency,
  validateTierDescription,
  validateTierDuration,
  validateTierName,
  validateTierPriceCents,
  validateTierVisibility,
} from '../domain/invariants'

describe('tier invariants — name', () => {
  it('acepta nombre normal', () => {
    expect(() => validateTierName('Básico')).not.toThrow()
  })

  it('acepta nombre con emoji + espacios', () => {
    expect(() => validateTierName('🌟 Premium')).not.toThrow()
  })

  it('rechaza nombre vacío post-trim', () => {
    expect(() => validateTierName('   ')).toThrow(ValidationError)
  })

  it('rechaza string vacío', () => {
    expect(() => validateTierName('')).toThrow(ValidationError)
  })

  it(`rechaza nombre > ${TIER_NAME_MAX_LENGTH} chars`, () => {
    expect(() => validateTierName('a'.repeat(TIER_NAME_MAX_LENGTH + 1))).toThrow(ValidationError)
  })

  it(`acepta nombre exactamente ${TIER_NAME_MAX_LENGTH} chars`, () => {
    expect(() => validateTierName('a'.repeat(TIER_NAME_MAX_LENGTH))).not.toThrow()
  })
})

describe('tier invariants — description', () => {
  it('acepta null', () => {
    expect(() => validateTierDescription(null)).not.toThrow()
  })

  it('acepta undefined', () => {
    expect(() => validateTierDescription(undefined)).not.toThrow()
  })

  it('acepta string vacío (se considera "sin descripción")', () => {
    expect(() => validateTierDescription('')).not.toThrow()
  })

  it('acepta descripción normal', () => {
    expect(() => validateTierDescription('Acceso a contenido premium del place.')).not.toThrow()
  })

  it(`rechaza descripción > ${TIER_DESCRIPTION_MAX_LENGTH} chars`, () => {
    expect(() => validateTierDescription('a'.repeat(TIER_DESCRIPTION_MAX_LENGTH + 1))).toThrow(
      ValidationError,
    )
  })

  it(`acepta descripción exactamente ${TIER_DESCRIPTION_MAX_LENGTH} chars`, () => {
    expect(() => validateTierDescription('a'.repeat(TIER_DESCRIPTION_MAX_LENGTH))).not.toThrow()
  })
})

describe('tier invariants — priceCents', () => {
  it('acepta 0 (tier gratis)', () => {
    expect(() => validateTierPriceCents(0)).not.toThrow()
  })

  it('acepta valor entero positivo dentro del rango', () => {
    expect(() => validateTierPriceCents(199)).not.toThrow()
    expect(() => validateTierPriceCents(99_999)).not.toThrow()
  })

  it(`acepta exactamente el cap (${TIER_PRICE_CENTS_MAX})`, () => {
    expect(() => validateTierPriceCents(TIER_PRICE_CENTS_MAX)).not.toThrow()
  })

  it('rechaza valores negativos', () => {
    expect(() => validateTierPriceCents(-1)).toThrow(ValidationError)
    expect(() => validateTierPriceCents(-100)).toThrow(ValidationError)
  })

  it('rechaza valor > cap', () => {
    expect(() => validateTierPriceCents(TIER_PRICE_CENTS_MAX + 1)).toThrow(ValidationError)
  })

  it('rechaza floats', () => {
    expect(() => validateTierPriceCents(199.5)).toThrow(ValidationError)
  })

  it('rechaza NaN', () => {
    expect(() => validateTierPriceCents(NaN)).toThrow(ValidationError)
  })

  it('rechaza Infinity', () => {
    expect(() => validateTierPriceCents(Infinity)).toThrow(ValidationError)
  })
})

describe('tier invariants — currency', () => {
  it('acepta USD', () => {
    expect(() => validateTierCurrency('USD')).not.toThrow()
  })

  it('rechaza monedas no soportadas v1', () => {
    expect(() => validateTierCurrency('ARS')).toThrow(ValidationError)
    expect(() => validateTierCurrency('BRL')).toThrow(ValidationError)
    expect(() => validateTierCurrency('eur')).toThrow(ValidationError)
  })

  it('rechaza string vacío', () => {
    expect(() => validateTierCurrency('')).toThrow(ValidationError)
  })
})

describe('tier invariants — duration', () => {
  it('acepta los 6 valores válidos', () => {
    for (const v of [
      'SEVEN_DAYS',
      'FIFTEEN_DAYS',
      'ONE_MONTH',
      'THREE_MONTHS',
      'SIX_MONTHS',
      'ONE_YEAR',
    ]) {
      expect(() => validateTierDuration(v)).not.toThrow()
    }
  })

  it('rechaza valores fuera del enum', () => {
    expect(() => validateTierDuration('TWO_WEEKS')).toThrow(ValidationError)
    expect(() => validateTierDuration('seven_days')).toThrow(ValidationError) // case sensitive
    expect(() => validateTierDuration('')).toThrow(ValidationError)
  })
})

describe('tier invariants — visibility', () => {
  it('acepta PUBLISHED y HIDDEN', () => {
    expect(() => validateTierVisibility('PUBLISHED')).not.toThrow()
    expect(() => validateTierVisibility('HIDDEN')).not.toThrow()
  })

  it('rechaza valores fuera del enum', () => {
    expect(() => validateTierVisibility('DRAFT')).toThrow(ValidationError)
    expect(() => validateTierVisibility('published')).toThrow(ValidationError)
    expect(() => validateTierVisibility('')).toThrow(ValidationError)
  })
})
