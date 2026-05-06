import { describe, expect, it } from 'vitest'
import {
  editorPluginsConfigSchema,
  parseEditorPluginsConfig,
} from '@/features/editor-config/domain/schemas'
import { DEFAULT_EDITOR_PLUGINS_CONFIG } from '@/features/editor-config/domain/types'

describe('editorPluginsConfigSchema', () => {
  it('acepta los 4 booleans en true', () => {
    const result = editorPluginsConfigSchema.safeParse(DEFAULT_EDITOR_PLUGINS_CONFIG)
    expect(result.success).toBe(true)
  })

  it('acepta combinaciones mixtas', () => {
    const result = editorPluginsConfigSchema.safeParse({
      youtube: true,
      spotify: false,
      applePodcasts: false,
      ivoox: true,
    })
    expect(result.success).toBe(true)
  })

  it('acepta los 4 booleans en false (place austero)', () => {
    const result = editorPluginsConfigSchema.safeParse({
      youtube: false,
      spotify: false,
      applePodcasts: false,
      ivoox: false,
    })
    expect(result.success).toBe(true)
  })

  it('rechaza shape con keys faltantes', () => {
    const result = editorPluginsConfigSchema.safeParse({
      youtube: true,
      spotify: true,
    })
    expect(result.success).toBe(false)
  })

  it('rechaza valores no-boolean', () => {
    const result = editorPluginsConfigSchema.safeParse({
      youtube: 'yes',
      spotify: true,
      applePodcasts: true,
      ivoox: true,
    })
    expect(result.success).toBe(false)
  })

  it('rechaza keys extra (strict)', () => {
    const result = editorPluginsConfigSchema.safeParse({
      ...DEFAULT_EDITOR_PLUGINS_CONFIG,
      tiktok: true,
    })
    expect(result.success).toBe(false)
  })

  it('rechaza null y arrays', () => {
    expect(editorPluginsConfigSchema.safeParse(null).success).toBe(false)
    expect(editorPluginsConfigSchema.safeParse([]).success).toBe(false)
  })
})

describe('parseEditorPluginsConfig', () => {
  it('retorna defaults para null', () => {
    expect(parseEditorPluginsConfig(null)).toEqual(DEFAULT_EDITOR_PLUGINS_CONFIG)
  })

  it('retorna defaults para arrays', () => {
    expect(parseEditorPluginsConfig([])).toEqual(DEFAULT_EDITOR_PLUGINS_CONFIG)
  })

  it('retorna defaults para tipo primitivo', () => {
    expect(parseEditorPluginsConfig('hello')).toEqual(DEFAULT_EDITOR_PLUGINS_CONFIG)
    expect(parseEditorPluginsConfig(42)).toEqual(DEFAULT_EDITOR_PLUGINS_CONFIG)
  })

  it('preserva shape válido', () => {
    const input = { youtube: false, spotify: true, applePodcasts: false, ivoox: true }
    expect(parseEditorPluginsConfig(input)).toEqual(input)
  })

  it('completa keys faltantes con defaults (defensivo contra rows con shape viejo)', () => {
    const result = parseEditorPluginsConfig({ youtube: false })
    expect(result).toEqual({
      youtube: false,
      spotify: true,
      applePodcasts: true,
      ivoox: true,
    })
  })

  it('descarta valores no-boolean por key específica y aplica default', () => {
    const result = parseEditorPluginsConfig({
      youtube: 'true',
      spotify: false,
      applePodcasts: 1,
      ivoox: false,
    })
    expect(result).toEqual({
      youtube: true,
      spotify: false,
      applePodcasts: true,
      ivoox: false,
    })
  })

  it('ignora keys extra silenciosamente (a diferencia del schema strict)', () => {
    const result = parseEditorPluginsConfig({
      ...DEFAULT_EDITOR_PLUGINS_CONFIG,
      tiktok: true,
    })
    expect(result).toEqual(DEFAULT_EDITOR_PLUGINS_CONFIG)
  })
})
