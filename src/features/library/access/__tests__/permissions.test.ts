import { describe, expect, it } from 'vitest'
import type { LibraryViewer } from '@/features/library/public'
import { canReadCategory, canReadItem, type CategoryReadContext } from '../domain/permissions'

/**
 * Tests para `canReadCategory` / `canReadItem` (G.2.a — read access scopes).
 *
 * Ver decisión #C ADR `2026-05-04-library-courses-and-read-access.md`:
 * owner siempre lee (bypass), después se evalúa por kind.
 */

const owner: LibraryViewer = {
  userId: 'owner-1',
  isAdmin: true,
  isOwner: true,
  groupIds: [],
  tierIds: [],
}

const admin: LibraryViewer = {
  userId: 'admin-1',
  isAdmin: true,
  isOwner: false,
  groupIds: [],
  tierIds: [],
}

const memberPlain: LibraryViewer = {
  userId: 'member-1',
  isAdmin: false,
  isOwner: false,
  groupIds: [],
  tierIds: [],
}

const memberInGroupA: LibraryViewer = {
  userId: 'member-2',
  isAdmin: false,
  isOwner: false,
  groupIds: ['grp-a'],
  tierIds: [],
}

const memberInTierX: LibraryViewer = {
  userId: 'member-3',
  isAdmin: false,
  isOwner: false,
  groupIds: [],
  tierIds: ['tier-x'],
}

const memberInOtherGroupAndTier: LibraryViewer = {
  userId: 'member-4',
  isAdmin: false,
  isOwner: false,
  groupIds: ['grp-z'],
  tierIds: ['tier-z'],
}

const publicCtx: CategoryReadContext = {
  readAccessKind: 'PUBLIC',
  groupReadIds: [],
  tierReadIds: [],
  userReadIds: [],
}

const groupsCtx: CategoryReadContext = {
  readAccessKind: 'GROUPS',
  groupReadIds: ['grp-a', 'grp-b'],
  tierReadIds: [],
  userReadIds: [],
}

const groupsCtxEmpty: CategoryReadContext = {
  readAccessKind: 'GROUPS',
  groupReadIds: [],
  tierReadIds: [],
  userReadIds: [],
}

const tiersCtx: CategoryReadContext = {
  readAccessKind: 'TIERS',
  groupReadIds: [],
  tierReadIds: ['tier-x', 'tier-y'],
  userReadIds: [],
}

const usersCtx: CategoryReadContext = {
  readAccessKind: 'USERS',
  groupReadIds: [],
  tierReadIds: [],
  userReadIds: ['member-1', 'consultant-99'],
}

describe('canReadCategory — owner bypass (decisión #C ADR 2026-05-04)', () => {
  it('owner SIEMPRE lee, sin importar el kind ni el set', () => {
    expect(canReadCategory(publicCtx, owner)).toBe(true)
    expect(canReadCategory(groupsCtx, owner)).toBe(true)
    expect(canReadCategory(groupsCtxEmpty, owner)).toBe(true)
    expect(canReadCategory(tiersCtx, owner)).toBe(true)
    expect(canReadCategory(usersCtx, owner)).toBe(true)
  })

  it('admin NO bypassa lectura (sólo owner — distinto de canCreateInCategory)', () => {
    // El admin que no es owner debe matchear el scope explícitamente.
    expect(canReadCategory(publicCtx, admin)).toBe(true) // PUBLIC para todos
    expect(canReadCategory(groupsCtx, admin)).toBe(false) // sin grupo asignado
    expect(canReadCategory(tiersCtx, admin)).toBe(false)
    expect(canReadCategory(usersCtx, admin)).toBe(false)
  })
})

describe('canReadCategory — kind=PUBLIC', () => {
  it('cualquier viewer lee', () => {
    expect(canReadCategory(publicCtx, memberPlain)).toBe(true)
    expect(canReadCategory(publicCtx, memberInGroupA)).toBe(true)
    expect(canReadCategory(publicCtx, memberInOtherGroupAndTier)).toBe(true)
  })
})

describe('canReadCategory — kind=GROUPS', () => {
  it('miembro en algún grupo del set: true', () => {
    expect(canReadCategory(groupsCtx, memberInGroupA)).toBe(true)
  })

  it('miembro sin grupos: false', () => {
    expect(canReadCategory(groupsCtx, memberPlain)).toBe(false)
  })

  it('miembro en otro grupo distinto al set: false', () => {
    expect(canReadCategory(groupsCtx, memberInOtherGroupAndTier)).toBe(false)
  })

  it('set vacío: nadie lee (default cerrado, salvo owner)', () => {
    expect(canReadCategory(groupsCtxEmpty, memberInGroupA)).toBe(false)
    expect(canReadCategory(groupsCtxEmpty, memberPlain)).toBe(false)
  })
})

describe('canReadCategory — kind=TIERS', () => {
  it('miembro con tier en el set: true', () => {
    expect(canReadCategory(tiersCtx, memberInTierX)).toBe(true)
  })

  it('miembro sin tiers: false', () => {
    expect(canReadCategory(tiersCtx, memberPlain)).toBe(false)
  })

  it('miembro con tier distinto al set: false', () => {
    expect(canReadCategory(tiersCtx, memberInOtherGroupAndTier)).toBe(false)
  })
})

describe('canReadCategory — kind=USERS', () => {
  it('user listado en el set: true', () => {
    expect(canReadCategory(usersCtx, memberPlain)).toBe(true) // 'member-1' está en set
  })

  it('user no listado: false', () => {
    expect(canReadCategory(usersCtx, memberInGroupA)).toBe(false)
    expect(canReadCategory(usersCtx, memberInTierX)).toBe(false)
  })
})

describe('canReadItem — delega en canReadCategory (lectura es a nivel categoría)', () => {
  // El ADR dice "categoría se lista para todos, gating al ABRIR un item".
  // La decisión real "puede ver el contenido" es de la categoría — no hay
  // override por item.
  const item = { categoryId: 'cat-1' }

  it('owner lee aunque no matchee scope', () => {
    expect(canReadItem(item, groupsCtx, owner)).toBe(true)
  })

  it('PUBLIC: cualquier viewer lee', () => {
    expect(canReadItem(item, publicCtx, memberPlain)).toBe(true)
  })

  it('GROUPS sin grupo del viewer: bloquea', () => {
    expect(canReadItem(item, groupsCtx, memberPlain)).toBe(false)
  })

  it('TIERS con tier del viewer: lee', () => {
    expect(canReadItem(item, tiersCtx, memberInTierX)).toBe(true)
  })

  it('USERS con user listado: lee', () => {
    expect(canReadItem(item, usersCtx, memberPlain)).toBe(true)
  })
})
