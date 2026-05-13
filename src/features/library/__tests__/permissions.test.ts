import { describe, expect, it } from 'vitest'
import {
  canArchiveItem,
  canEditCategory,
  canEditItem,
  type LibraryViewer,
} from '../domain/permissions'

/**
 * Tests del slice raíz `library/` para permisos de category/item edit.
 * El gate de creación (canWriteCategory) vive en
 * `library/contribution/__tests__/permissions.test.ts` desde S1b.
 */

const adminViewer: LibraryViewer = {
  userId: 'admin-1',
  isAdmin: true,
  isOwner: false,
  groupIds: [],
  tierIds: [],
}
const memberViewer: LibraryViewer = {
  userId: 'member-1',
  isAdmin: false,
  isOwner: false,
  groupIds: [],
  tierIds: [],
}

describe('canEditCategory', () => {
  it('solo admin/owner', () => {
    expect(canEditCategory(adminViewer)).toBe(true)
    expect(canEditCategory(memberViewer)).toBe(false)
  })
})

describe('canEditItem / canArchiveItem', () => {
  const itemByMember = { authorUserId: 'member-1' }
  const itemByOther = { authorUserId: 'someone-else' }
  const itemOrphan = { authorUserId: null }

  it('admin: siempre puede', () => {
    expect(canEditItem(itemByOther, adminViewer)).toBe(true)
    expect(canArchiveItem(itemOrphan, adminViewer)).toBe(true)
  })

  it('author: puede editar/archivar lo suyo', () => {
    expect(canEditItem(itemByMember, memberViewer)).toBe(true)
    expect(canArchiveItem(itemByMember, memberViewer)).toBe(true)
  })

  it('miembro NO author: rechazado', () => {
    expect(canEditItem(itemByOther, memberViewer)).toBe(false)
    expect(canArchiveItem(itemByOther, memberViewer)).toBe(false)
  })

  it('item huérfano (post-erasure 365d): solo admin', () => {
    expect(canEditItem(itemOrphan, memberViewer)).toBe(false)
    expect(canArchiveItem(itemOrphan, memberViewer)).toBe(false)
  })
})
