import { describe, expect, it } from 'vitest'
import { templateCreateSchema } from '../schemas'

/**
 * Tests de la capa de dominio + schemas.
 * Tests de server actions/queries viven en este mismo directorio.
 * Tests de UI viven junto al componente si son útiles.
 */

describe('templateCreateSchema', () => {
  it('rechaza name vacío', () => {
    expect(templateCreateSchema.safeParse({ name: '' }).success).toBe(false)
  })

  it('acepta name válido', () => {
    expect(templateCreateSchema.safeParse({ name: 'ok' }).success).toBe(true)
  })
})
