import { describe, expect, it } from 'vitest'
import { isActiveMembership, isTierAssignable } from '../domain/invariants'

describe('isTierAssignable', () => {
  it('PUBLISHED → true', () => {
    expect(isTierAssignable('PUBLISHED')).toBe(true)
  })

  it('HIDDEN → false', () => {
    expect(isTierAssignable('HIDDEN')).toBe(false)
  })
})

describe('isActiveMembership', () => {
  it('null o undefined → false', () => {
    expect(isActiveMembership(null)).toBe(false)
    expect(isActiveMembership(undefined)).toBe(false)
  })

  it('row con leftAt = null → true', () => {
    expect(isActiveMembership({ leftAt: null })).toBe(true)
  })

  it('row con leftAt = Date → false (ex-miembro)', () => {
    expect(isActiveMembership({ leftAt: new Date() })).toBe(false)
  })

  it('shape sin leftAt (resultado pre-filtrado de findActiveMembership) → true', () => {
    // findActiveMembership ya filtra leftAt:null en el WHERE — un objeto
    // retornado significa "es miembro activo" sin necesidad de re-chequear.
    expect(isActiveMembership({})).toBe(true)
    // El cast tolera el shape `{ id, role }` real de findActiveMembership
    // sin importar el tipo concreto.
    const membershipLike = { id: 'membership-1' } as Parameters<typeof isActiveMembership>[0]
    expect(isActiveMembership(membershipLike)).toBe(true)
  })
})
