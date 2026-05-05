import { describe, expect, it } from 'vitest'
import { formatPrice } from './format-price'

describe('formatPrice', () => {
  it('retorna "Gratis" para priceCents = 0', () => {
    expect(formatPrice(0, 'USD')).toBe('Gratis')
  })

  it('formatea centavos > 0 con separador decimal coma (locale es-AR)', () => {
    // Distintas versiones de ICU pueden usar 'US$ 1,99' o 'USD 1,99' —
    // toContain matchea el número formateado, que es lo que nos importa.
    const out = formatPrice(199, 'USD')
    expect(out).toContain('1,99')
  })

  it('formatea $9.99 (priceCents = 999)', () => {
    const out = formatPrice(999, 'USD')
    expect(out).toContain('9,99')
  })

  it('formatea cap defensivo $9,999.99 (priceCents = 999_999)', () => {
    const out = formatPrice(999_999, 'USD')
    // Spanish thousand separator es punto (es-AR formatea 9.999,99).
    expect(out).toContain('9.999,99')
  })

  it('soporta locale custom — en-US devuelve formato anglosajón', () => {
    const out = formatPrice(199, 'USD', 'en-US')
    expect(out).toContain('1.99')
  })

  it('preserva el código de currency en el output (no asume USD)', () => {
    // Aunque v1 hardcodea USD, el helper acepta cualquier currency válida
    // (preparado para Stripe Connect: BRL/MXN, etc.).
    const out = formatPrice(1000, 'BRL')
    // Esperamos que el formato incluya el símbolo o código BRL.
    // Tests defensivos: cualquiera de los dos shapes vale.
    expect(out.includes('R$') || out.includes('BRL')).toBe(true)
  })

  it('un mismo monto en distintas currencies da output distinto', () => {
    expect(formatPrice(1000, 'USD')).not.toBe(formatPrice(1000, 'BRL'))
  })

  it('no confunde 0 con 100 — 100 ⇒ formato Intl, no "Gratis"', () => {
    const out = formatPrice(100, 'USD')
    expect(out).not.toBe('Gratis')
    expect(out).toContain('1,00')
  })
})
