import { describe, expect, it } from 'vitest'
import { tierDurationLabel, tierDurationToDays } from '../domain/duration'

describe('tierDurationToDays', () => {
  it('mapea cada enum a su número de días canónico', () => {
    expect(tierDurationToDays('SEVEN_DAYS')).toBe(7)
    expect(tierDurationToDays('FIFTEEN_DAYS')).toBe(15)
    expect(tierDurationToDays('ONE_MONTH')).toBe(30)
    expect(tierDurationToDays('THREE_MONTHS')).toBe(90)
    expect(tierDurationToDays('SIX_MONTHS')).toBe(180)
    expect(tierDurationToDays('ONE_YEAR')).toBe(365)
  })

  it('todos los valores son enteros positivos', () => {
    const values: Array<Parameters<typeof tierDurationToDays>[0]> = [
      'SEVEN_DAYS',
      'FIFTEEN_DAYS',
      'ONE_MONTH',
      'THREE_MONTHS',
      'SIX_MONTHS',
      'ONE_YEAR',
    ]
    for (const d of values) {
      const days = tierDurationToDays(d)
      expect(Number.isInteger(days)).toBe(true)
      expect(days).toBeGreaterThan(0)
    }
  })
})

describe('tierDurationLabel', () => {
  it('devuelve labels en español', () => {
    expect(tierDurationLabel('SEVEN_DAYS')).toBe('7 días')
    expect(tierDurationLabel('FIFTEEN_DAYS')).toBe('15 días')
    expect(tierDurationLabel('ONE_MONTH')).toBe('1 mes')
    expect(tierDurationLabel('THREE_MONTHS')).toBe('3 meses')
    expect(tierDurationLabel('SIX_MONTHS')).toBe('6 meses')
    expect(tierDurationLabel('ONE_YEAR')).toBe('1 año')
  })
})
