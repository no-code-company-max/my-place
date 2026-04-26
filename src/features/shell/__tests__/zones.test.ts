import { describe, expect, it } from 'vitest'
import { ZONES, deriveActiveZone } from '../domain/zones'

describe('ZONES', () => {
  it('contiene 3 zonas (Inicio, Conversaciones, Eventos) en orden', () => {
    expect(ZONES).toHaveLength(3)
    expect(ZONES[0]?.label).toBe('Inicio')
    expect(ZONES[1]?.label).toBe('Conversaciones')
    expect(ZONES[2]?.label).toBe('Eventos')
  })

  it('cada zona tiene index match con su posición', () => {
    ZONES.forEach((zone, i) => {
      expect(zone.index).toBe(i)
    })
  })

  it('library NO está en zones (diferida)', () => {
    expect(ZONES.find((z) => z.label.toLowerCase().includes('library'))).toBeUndefined()
    expect(ZONES.find((z) => z.label.toLowerCase().includes('biblioteca'))).toBeUndefined()
  })
})

describe('deriveActiveZone', () => {
  it('"/" devuelve 0 (Inicio)', () => {
    expect(deriveActiveZone('/')).toBe(0)
  })

  it('trailing slash es tolerado: "/conversations/" → 1', () => {
    expect(deriveActiveZone('/conversations/')).toBe(1)
    expect(deriveActiveZone('/events/')).toBe(2)
  })

  it('"/conversations" y sub-paths → 1', () => {
    expect(deriveActiveZone('/conversations')).toBe(1)
    expect(deriveActiveZone('/conversations/some-slug')).toBe(1)
    expect(deriveActiveZone('/conversations/new')).toBe(1)
  })

  it('"/events" y sub-paths → 2', () => {
    expect(deriveActiveZone('/events')).toBe(2)
    expect(deriveActiveZone('/events/abc/edit')).toBe(2)
    expect(deriveActiveZone('/events/new')).toBe(2)
  })

  it('paths fuera de zonas devuelven null (settings, m, etc.)', () => {
    expect(deriveActiveZone('/settings')).toBeNull()
    expect(deriveActiveZone('/settings/flags')).toBeNull()
    expect(deriveActiveZone('/m/user-123')).toBeNull()
    expect(deriveActiveZone('/login')).toBeNull()
  })

  it('múltiples trailing slashes normalizan a "/"', () => {
    expect(deriveActiveZone('//')).toBe(0)
    expect(deriveActiveZone('///')).toBe(0)
  })
})
