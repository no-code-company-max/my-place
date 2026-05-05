import { describe, expect, it } from 'vitest'
import type { LibraryViewer } from '@/features/library/public'
import { canMarkItemCompleted, canOpenItem, type ItemForPrereqCheck } from '../domain/permissions'

/**
 * Tests para los permisos del sub-slice library/courses (G.3.a).
 *
 * Cubrimos la matriz del ADR `2026-05-04-library-courses-and-read-access.md`
 * D2 (sequential unlock) + decisión #C (owner bypass).
 */

const ownerViewer: LibraryViewer = {
  userId: 'owner-1',
  isAdmin: true,
  isOwner: true,
  groupIds: [],
  tierIds: [],
}

const adminMemberViewer: LibraryViewer = {
  userId: 'admin-1',
  isAdmin: true, // admin via grupo de permisos
  isOwner: false, // pero NO owner
  groupIds: ['grp-preset-admins'],
  tierIds: [],
}

const memberViewer: LibraryViewer = {
  userId: 'member-1',
  isAdmin: false,
  isOwner: false,
  groupIds: [],
  tierIds: [],
}

const itemNoPrereq: ItemForPrereqCheck = { prereqItemId: null }
const itemWithPrereq: ItemForPrereqCheck = { prereqItemId: 'item-A' }

describe('canMarkItemCompleted', () => {
  it('member común: true (caller validó membership previa)', () => {
    expect(canMarkItemCompleted(itemNoPrereq, memberViewer)).toBe(true)
    expect(canMarkItemCompleted(itemWithPrereq, memberViewer)).toBe(true)
  })

  it('owner: true (puede marcar aunque no le aporte funcionalmente)', () => {
    expect(canMarkItemCompleted(itemNoPrereq, ownerViewer)).toBe(true)
    expect(canMarkItemCompleted(itemWithPrereq, ownerViewer)).toBe(true)
  })

  it('admin no-owner: true', () => {
    expect(canMarkItemCompleted(itemNoPrereq, adminMemberViewer)).toBe(true)
  })
})

describe('canOpenItem — owner bypass (decisión #C ADR)', () => {
  it('owner abre item sin prereq con cualquier completionList', () => {
    expect(canOpenItem(itemNoPrereq, ownerViewer, [])).toBe(true)
    expect(canOpenItem(itemNoPrereq, ownerViewer, ['otro'])).toBe(true)
  })

  it('owner abre item con prereq INCOMPLETO (bypass total)', () => {
    expect(canOpenItem(itemWithPrereq, ownerViewer, [])).toBe(true)
    expect(canOpenItem(itemWithPrereq, ownerViewer, ['otro'])).toBe(true)
  })

  it('owner abre item con prereq completado (consistencia)', () => {
    expect(canOpenItem(itemWithPrereq, ownerViewer, ['item-A'])).toBe(true)
  })

  it('admin no-owner SIN bypass: respeta prereqs como cualquier viewer', () => {
    // Admin via grupo NO bypassa prereqs (sólo owner — D2 ADR es estricto).
    expect(canOpenItem(itemWithPrereq, adminMemberViewer, [])).toBe(false)
  })
})

describe('canOpenItem — sin prereq', () => {
  it('member común abre item sin prereq', () => {
    expect(canOpenItem(itemNoPrereq, memberViewer, [])).toBe(true)
  })

  it('member común abre item sin prereq incluso con completionList vacía', () => {
    expect(canOpenItem(itemNoPrereq, memberViewer, [])).toBe(true)
  })
})

describe('canOpenItem — con prereq', () => {
  it('member completó el prereq → true', () => {
    expect(canOpenItem(itemWithPrereq, memberViewer, ['item-A'])).toBe(true)
  })

  it('member NO completó el prereq → false', () => {
    expect(canOpenItem(itemWithPrereq, memberViewer, [])).toBe(false)
    expect(canOpenItem(itemWithPrereq, memberViewer, ['otro-item'])).toBe(false)
  })

  it('member completó otros items pero no el prereq → false', () => {
    expect(canOpenItem(itemWithPrereq, memberViewer, ['item-X', 'item-Y', 'item-Z'])).toBe(false)
  })

  it('member completó el prereq + otros → true', () => {
    expect(canOpenItem(itemWithPrereq, memberViewer, ['item-X', 'item-A', 'item-Y'])).toBe(true)
  })
})
