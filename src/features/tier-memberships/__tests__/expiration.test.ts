import { describe, expect, it, vi } from 'vitest'

/**
 * Mock del barrel `tiers/public` — sin esto, el barrel arrastra los Server
 * Actions del slice (que cargan `serverEnv` para Supabase) y el test puro
 * crashea en jsdom sin `.env.local`. Sólo necesitamos `tierDurationToDays`
 * y el tipo `TierDuration`; mockear ambos mantiene el test 100% puro.
 *
 * Sigue siendo un test de la implementación real de `computeExpiresAt` —
 * únicamente las dependencias cross-slice se mockean.
 */
vi.mock('@/features/tiers/public', () => {
  const days: Record<string, number> = {
    SEVEN_DAYS: 7,
    FIFTEEN_DAYS: 15,
    ONE_MONTH: 30,
    THREE_MONTHS: 90,
    SIX_MONTHS: 180,
    ONE_YEAR: 365,
  }
  return {
    tierDurationToDays: (d: string) => days[d] ?? 0,
  }
})

import { computeExpiresAt } from '../domain/expiration'

type TierDuration =
  | 'SEVEN_DAYS'
  | 'FIFTEEN_DAYS'
  | 'ONE_MONTH'
  | 'THREE_MONTHS'
  | 'SIX_MONTHS'
  | 'ONE_YEAR'

const ASSIGNED_AT = new Date('2026-05-02T10:00:00Z')
const MS_PER_DAY = 24 * 60 * 60 * 1000

describe('computeExpiresAt', () => {
  it('indefinite=true → null sea cual sea la duración', () => {
    expect(computeExpiresAt(ASSIGNED_AT, 'SEVEN_DAYS', true)).toBeNull()
    expect(computeExpiresAt(ASSIGNED_AT, 'ONE_MONTH', true)).toBeNull()
    expect(computeExpiresAt(ASSIGNED_AT, 'ONE_YEAR', true)).toBeNull()
  })

  it('SEVEN_DAYS → assignedAt + 7 días', () => {
    const result = computeExpiresAt(ASSIGNED_AT, 'SEVEN_DAYS', false)
    expect(result?.getTime()).toBe(ASSIGNED_AT.getTime() + 7 * MS_PER_DAY)
  })

  it('FIFTEEN_DAYS → assignedAt + 15 días', () => {
    const result = computeExpiresAt(ASSIGNED_AT, 'FIFTEEN_DAYS', false)
    expect(result?.getTime()).toBe(ASSIGNED_AT.getTime() + 15 * MS_PER_DAY)
  })

  it('ONE_MONTH → assignedAt + 30 días', () => {
    const result = computeExpiresAt(ASSIGNED_AT, 'ONE_MONTH', false)
    expect(result?.getTime()).toBe(ASSIGNED_AT.getTime() + 30 * MS_PER_DAY)
  })

  it('THREE_MONTHS → assignedAt + 90 días', () => {
    const result = computeExpiresAt(ASSIGNED_AT, 'THREE_MONTHS', false)
    expect(result?.getTime()).toBe(ASSIGNED_AT.getTime() + 90 * MS_PER_DAY)
  })

  it('SIX_MONTHS → assignedAt + 180 días', () => {
    const result = computeExpiresAt(ASSIGNED_AT, 'SIX_MONTHS', false)
    expect(result?.getTime()).toBe(ASSIGNED_AT.getTime() + 180 * MS_PER_DAY)
  })

  it('ONE_YEAR → assignedAt + 365 días', () => {
    const result = computeExpiresAt(ASSIGNED_AT, 'ONE_YEAR', false)
    expect(result?.getTime()).toBe(ASSIGNED_AT.getTime() + 365 * MS_PER_DAY)
  })

  it('cobertura exhaustiva de los 6 valores de TierDuration', () => {
    const all: ReadonlyArray<TierDuration> = [
      'SEVEN_DAYS',
      'FIFTEEN_DAYS',
      'ONE_MONTH',
      'THREE_MONTHS',
      'SIX_MONTHS',
      'ONE_YEAR',
    ]
    for (const d of all) {
      const result = computeExpiresAt(ASSIGNED_AT, d, false)
      expect(result).toBeInstanceOf(Date)
      expect(result?.getTime()).toBeGreaterThan(ASSIGNED_AT.getTime())
    }
  })

  it('preserva el tiempo del día (no rounding al día)', () => {
    const oddTime = new Date('2026-05-02T10:37:42.123Z')
    const result = computeExpiresAt(oddTime, 'SEVEN_DAYS', false)
    expect(result?.toISOString()).toBe('2026-05-09T10:37:42.123Z')
  })
})
