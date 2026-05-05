import { describe, it, expect } from 'vitest'
import {
  PLACE_MAX_MEMBERS,
  assertInviterHasAdminAccess,
  assertPlaceActive,
  assertPlaceHasCapacity,
  generateInvitationToken,
} from '../domain/invariants'
import { AuthorizationError, ConflictError, InvariantViolation } from '@/shared/errors/domain-error'

describe('assertPlaceHasCapacity', () => {
  it('acepta por debajo del límite', () => {
    expect(() => assertPlaceHasCapacity(0)).not.toThrow()
    expect(() => assertPlaceHasCapacity(PLACE_MAX_MEMBERS - 1)).not.toThrow()
  })

  it('rechaza en el límite (150)', () => {
    expect(() => assertPlaceHasCapacity(PLACE_MAX_MEMBERS)).toThrow(InvariantViolation)
  })

  it('rechaza por encima del límite', () => {
    expect(() => assertPlaceHasCapacity(PLACE_MAX_MEMBERS + 1)).toThrow(InvariantViolation)
  })
})

describe('assertInviterHasAdminAccess', () => {
  it('acepta owner (isAdmin=true por herencia)', () => {
    expect(() =>
      assertInviterHasAdminAccess({ isMember: true, isOwner: true, isAdmin: true }),
    ).not.toThrow()
  })

  it('acepta admin de preset group sin ownership', () => {
    expect(() =>
      assertInviterHasAdminAccess({ isMember: true, isOwner: false, isAdmin: true }),
    ).not.toThrow()
  })

  it('rechaza miembro simple con AuthorizationError', () => {
    expect(() =>
      assertInviterHasAdminAccess({ isMember: true, isOwner: false, isAdmin: false }),
    ).toThrow(AuthorizationError)
  })

  it('rechaza ausencia de permisos con AuthorizationError', () => {
    expect(() =>
      assertInviterHasAdminAccess({ isMember: false, isOwner: false, isAdmin: false }),
    ).toThrow(AuthorizationError)
  })
})

describe('assertPlaceActive', () => {
  it('acepta place no archivado', () => {
    expect(() => assertPlaceActive({ archivedAt: null })).not.toThrow()
  })

  it('rechaza place archivado con ConflictError', () => {
    expect(() => assertPlaceActive({ archivedAt: new Date() })).toThrow(ConflictError)
  })
})

describe('generateInvitationToken', () => {
  it('retorna base64url sin padding ni caracteres no-url-safe', () => {
    const token = generateInvitationToken()
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('tiene longitud esperada para 32 bytes (43 chars base64url sin padding)', () => {
    expect(generateInvitationToken()).toHaveLength(43)
  })

  it('genera valores distintos en llamadas sucesivas', () => {
    const a = generateInvitationToken()
    const b = generateInvitationToken()
    expect(a).not.toBe(b)
  })

  it('respeta el parámetro `bytes` si se pasa', () => {
    // 16 bytes → ceil(16/3)*4 - pad = 22 chars base64url sin padding
    expect(generateInvitationToken(16)).toHaveLength(22)
  })
})
