import { describe, expect, it } from 'vitest'
import {
  arePermissionsValid,
  GROUP_NAME_MAX_LENGTH,
  GROUP_NAME_MIN_LENGTH,
  isValidGroupName,
  normalizePermissions,
  partitionPermissions,
} from '../domain/invariants'
import { isAdminPreset, presetPermissions } from '../domain/presets'
import { ADMIN_PRESET_NAME, PERMISSIONS_ALL } from '../domain/permissions'

describe('isValidGroupName', () => {
  it(`acepta nombre con ${GROUP_NAME_MIN_LENGTH}..${GROUP_NAME_MAX_LENGTH} chars`, () => {
    expect(isValidGroupName('Moderadores')).toBe(true)
    expect(isValidGroupName('M')).toBe(true)
    expect(isValidGroupName('A'.repeat(GROUP_NAME_MAX_LENGTH))).toBe(true)
  })

  it('rechaza vacío y > max', () => {
    expect(isValidGroupName('')).toBe(false)
    expect(isValidGroupName('   ')).toBe(false)
    expect(isValidGroupName('A'.repeat(GROUP_NAME_MAX_LENGTH + 1))).toBe(false)
  })

  it('trims antes de medir', () => {
    expect(isValidGroupName('   Mods   ')).toBe(true)
  })
})

describe('partitionPermissions', () => {
  it('separa válidos de inválidos y dedupea', () => {
    const result = partitionPermissions([
      'discussions:hide-post',
      'discussions:hide-post',
      'unknown:foo',
      'flags:review',
    ])
    expect(result.valid).toEqual(['discussions:hide-post', 'flags:review'])
    expect(result.invalid).toEqual(['unknown:foo'])
  })

  it('lista vacía → ambos vacíos', () => {
    expect(partitionPermissions([])).toEqual({ valid: [], invalid: [] })
  })
})

describe('arePermissionsValid', () => {
  it('true cuando todos están en el enum', () => {
    expect(arePermissionsValid([...PERMISSIONS_ALL])).toBe(true)
  })

  it('false si algún string no está en el enum', () => {
    expect(arePermissionsValid(['flags:review', 'evil:exec'])).toBe(false)
  })

  it('true para lista vacía (subset trivial)', () => {
    expect(arePermissionsValid([])).toBe(true)
  })
})

describe('normalizePermissions', () => {
  it('descarta inválidos y dedupea', () => {
    const result = normalizePermissions([
      'flags:review',
      'flags:review',
      'malicious',
      'members:invite',
    ])
    expect(result).toEqual(['flags:review', 'members:invite'])
  })
})

describe('presetPermissions', () => {
  it('devuelve copia de PERMISSIONS_ALL (todos los permisos atómicos)', () => {
    const list = presetPermissions()
    expect(list).toEqual([...PERMISSIONS_ALL])
    // Modificar el resultado no muta la lista interna.
    list.pop()
    expect(presetPermissions().length).toBe(PERMISSIONS_ALL.length)
  })
})

describe('isAdminPreset', () => {
  it('true si isPreset=true (con o sin name match)', () => {
    expect(isAdminPreset({ isPreset: true })).toBe(true)
    expect(isAdminPreset({ isPreset: true, name: ADMIN_PRESET_NAME })).toBe(true)
    // Defensive: si isPreset=true y name fue cambiado, sigue siendo preset.
    expect(isAdminPreset({ isPreset: true, name: 'Renombrado' })).toBe(true)
  })

  it('false si isPreset=false', () => {
    expect(isAdminPreset({ isPreset: false })).toBe(false)
    expect(isAdminPreset({ isPreset: false, name: ADMIN_PRESET_NAME })).toBe(false)
  })
})
