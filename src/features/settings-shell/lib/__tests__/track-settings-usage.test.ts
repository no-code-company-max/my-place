import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { STORAGE_KEY, trackSettingsUsage, getTopUsage, resetUsage } from '../track-settings-usage'

beforeEach(() => {
  // Limpiar localStorage entre tests para aislamiento
  localStorage.clear()
})

afterEach(() => {
  localStorage.clear()
})

describe('trackSettingsUsage', () => {
  it('NO trackea pathname fuera de /settings/', () => {
    trackSettingsUsage('/conversations')
    trackSettingsUsage('/inbox')
    trackSettingsUsage('/the-company')
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('NO trackea /settings raíz (sin sub-page)', () => {
    trackSettingsUsage('/settings')
    trackSettingsUsage('/settings/')
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('trackea /settings/<slug> incrementando contador del slug', () => {
    trackSettingsUsage('/settings/hours')
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored.hours).toBe(1)
  })

  it('llamadas múltiples al mismo slug acumulan contador', () => {
    trackSettingsUsage('/settings/members')
    trackSettingsUsage('/settings/members')
    trackSettingsUsage('/settings/members')
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored.members).toBe(3)
  })

  it('mantiene contadores independientes por slug', () => {
    trackSettingsUsage('/settings/hours')
    trackSettingsUsage('/settings/hours')
    trackSettingsUsage('/settings/members')
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored.hours).toBe(2)
    expect(stored.members).toBe(1)
  })

  it('trackea correctamente sub-paths profundos (extrae solo el primer slug)', () => {
    trackSettingsUsage('/settings/groups/group-id-123')
    trackSettingsUsage('/settings/members/user-id-456')
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored.groups).toBe(1)
    expect(stored.members).toBe(1)
  })
})

describe('getTopUsage', () => {
  it('retorna [] cuando no hay tracking previo', () => {
    expect(getTopUsage(3)).toEqual([])
  })

  it('retorna top-N ordenado por count desc', () => {
    trackSettingsUsage('/settings/hours')
    trackSettingsUsage('/settings/hours')
    trackSettingsUsage('/settings/hours')
    trackSettingsUsage('/settings/members')
    trackSettingsUsage('/settings/library')
    trackSettingsUsage('/settings/library')

    const top = getTopUsage(3)
    expect(top.map((t) => t.slug)).toEqual(['hours', 'library', 'members'])
    expect(top.map((t) => t.count)).toEqual([3, 2, 1])
  })

  it('limita al topN solicitado', () => {
    for (let i = 0; i < 5; i++) trackSettingsUsage('/settings/hours')
    for (let i = 0; i < 4; i++) trackSettingsUsage('/settings/members')
    for (let i = 0; i < 3; i++) trackSettingsUsage('/settings/library')
    for (let i = 0; i < 2; i++) trackSettingsUsage('/settings/groups')
    trackSettingsUsage('/settings/tiers')

    const top3 = getTopUsage(3)
    expect(top3).toHaveLength(3)
    expect(top3.map((t) => t.slug)).toEqual(['hours', 'members', 'library'])
  })

  it('default topN = 3 si no se pasa argumento', () => {
    for (let i = 0; i < 5; i++) trackSettingsUsage('/settings/hours')
    for (let i = 0; i < 4; i++) trackSettingsUsage('/settings/members')
    for (let i = 0; i < 3; i++) trackSettingsUsage('/settings/library')
    for (let i = 0; i < 2; i++) trackSettingsUsage('/settings/groups')

    expect(getTopUsage()).toHaveLength(3)
  })

  it('safe ante localStorage corrupto: retorna [] sin crashear', () => {
    localStorage.setItem(STORAGE_KEY, 'not valid json {{{')
    expect(getTopUsage(3)).toEqual([])
  })
})

describe('resetUsage', () => {
  it('limpia el localStorage del tracking', () => {
    trackSettingsUsage('/settings/hours')
    trackSettingsUsage('/settings/members')
    expect(getTopUsage()).toHaveLength(2)

    resetUsage()
    expect(getTopUsage()).toEqual([])
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})

describe('SSR safety', () => {
  it('trackSettingsUsage no crashea cuando window no existe (no-op)', () => {
    const originalWindow = global.window
    // @ts-expect-error simulamos SSR borrando window
    delete global.window
    expect(() => trackSettingsUsage('/settings/hours')).not.toThrow()
    global.window = originalWindow
  })

  it('getTopUsage retorna [] cuando window no existe (SSR)', () => {
    const originalWindow = global.window
    // @ts-expect-error simulamos SSR
    delete global.window
    expect(getTopUsage()).toEqual([])
    global.window = originalWindow
  })
})
