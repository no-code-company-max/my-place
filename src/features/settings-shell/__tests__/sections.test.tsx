import { describe, expect, it } from 'vitest'
import { buildSettingsShellSections } from '../domain/sections'

describe('buildSettingsShellSections', () => {
  it('admin (no owner): incluye Place + Comunidad/Library + Contenido sin items owner-only', () => {
    const result = buildSettingsShellSections({ isOwner: false, placeSlug: 'the-company' })
    const slugSet = new Set(result.flatMap((g) => g.items.map((i) => i.href)))

    // Items visibles para admin (no owner-only)
    expect(slugSet).toContain('/the-company/settings/hours')
    expect(slugSet).toContain('/the-company/settings/access')
    expect(slugSet).toContain('/the-company/settings/library')
    expect(slugSet).toContain('/the-company/settings/flags')

    // Items owner-only NO visibles para admin
    expect(slugSet).not.toContain('/the-company/settings/members')
    expect(slugSet).not.toContain('/the-company/settings/groups')
    expect(slugSet).not.toContain('/the-company/settings/tiers')
    expect(slugSet).not.toContain('/the-company/settings/editor')
  })

  it('owner: incluye TODOS los items (Place + Comunidad + Contenido)', () => {
    const result = buildSettingsShellSections({ isOwner: true, placeSlug: 'the-company' })
    const slugSet = new Set(result.flatMap((g) => g.items.map((i) => i.href)))

    expect(slugSet).toContain('/the-company/settings/hours')
    expect(slugSet).toContain('/the-company/settings/access')
    expect(slugSet).toContain('/the-company/settings/editor')
    expect(slugSet).toContain('/the-company/settings/members')
    expect(slugSet).toContain('/the-company/settings/groups')
    expect(slugSet).toContain('/the-company/settings/tiers')
    expect(slugSet).toContain('/the-company/settings/library')
    expect(slugSet).toContain('/the-company/settings/flags')
  })

  it('NO incluye el slug "" (general / dashboard) — futuro', () => {
    const result = buildSettingsShellSections({ isOwner: true, placeSlug: 'the-company' })
    const allHrefs = result.flatMap((g) => g.items.map((i) => i.href))
    expect(allHrefs).not.toContain('/the-company/settings/')
    expect(allHrefs).not.toContain('/the-company/settings')
  })

  it('todos los hrefs son absolutos y empiezan con /<placeSlug>/settings/', () => {
    const result = buildSettingsShellSections({ isOwner: true, placeSlug: 'mi-place' })
    for (const group of result) {
      for (const item of group.items) {
        expect(item.href).toMatch(/^\/mi-place\/settings\/[a-z]+$/)
      }
    }
  })

  it('todos los items tienen icon (de lucide-react)', () => {
    const result = buildSettingsShellSections({ isOwner: true, placeSlug: 'x' })
    for (const group of result) {
      for (const item of group.items) {
        expect(item.icon).toBeDefined()
      }
    }
  })

  it('groups vacíos se filtran (admin sin items owner-only en Comunidad)', () => {
    // Comunidad tiene members/groups/tiers, todos owner-only.
    // Admin (no owner) → group Comunidad debería quedar vacío y filtrarse.
    const result = buildSettingsShellSections({ isOwner: false, placeSlug: 'x' })
    const groupIds = result.map((g) => g.id)
    expect(groupIds).not.toContain('comunidad')
    // Pero Place y Contenido sí (tienen items visibles para admin)
    expect(groupIds).toContain('place')
    expect(groupIds).toContain('contenido')
  })

  it('respeta el orden de groups (Place → Comunidad → Contenido) y de items dentro de cada group', () => {
    const result = buildSettingsShellSections({ isOwner: true, placeSlug: 'x' })
    expect(result.map((g) => g.id)).toEqual(['place', 'comunidad', 'contenido'])
    // Orden dentro de Place: hours, access, editor
    const place = result.find((g) => g.id === 'place')
    expect(place?.items.map((i) => i.href)).toEqual([
      '/x/settings/hours',
      '/x/settings/access',
      '/x/settings/editor',
    ])
  })

  it('placeSlug se inyecta correctamente (multi-place safe)', () => {
    const a = buildSettingsShellSections({ isOwner: true, placeSlug: 'place-a' })
    const b = buildSettingsShellSections({ isOwner: true, placeSlug: 'place-b' })
    const aHrefs = a.flatMap((g) => g.items.map((i) => i.href))
    const bHrefs = b.flatMap((g) => g.items.map((i) => i.href))
    expect(aHrefs.every((h) => h.startsWith('/place-a/'))).toBe(true)
    expect(bHrefs.every((h) => h.startsWith('/place-b/'))).toBe(true)
  })
})
