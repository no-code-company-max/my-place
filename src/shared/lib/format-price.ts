/**
 * Formato user-facing de precios.
 *
 * Vive en `shared/lib/` anticipando reuso en pricing pages futuros y
 * en otros features financieros (events ticketing, BYO storage tiers,
 * etc.). Si tiers resulta el único consumidor a 6 meses, se mueve a
 * `tiers/domain/`.
 *
 * Decisión locale `'es-AR'` con `Intl.NumberFormat`. Razones:
 *  1. UI del producto en español (CLAUDE.md § Idioma).
 *  2. La mayoría de places del MVP están en Argentina.
 *  3. `Intl.NumberFormat` es estándar web — sin libs externas, sin
 *     bundle weight, soporta cualquier currency cuando llegue Stripe.
 *
 * Ver `docs/features/tiers/spec.md` § 11 y ADR § 5.
 */

/**
 * Convierte centavos a string legible.
 *
 * - `priceCents = 0` ⇒ `'Gratis'` (caso "colaboradores", "early access").
 * - `priceCents > 0` ⇒ formato `Intl` con currency. Ej:
 *   `formatPrice(199, 'USD')` → `'US$ 1,99'` o `'USD 1,99'` según
 *   versión de ICU del runtime (acepta ambos — el test usa
 *   `toContain('1,99')`).
 *
 * `priceCents` debe ser entero ≥ 0 (validado por Zod en las actions).
 * No se chequea acá para mantener la función pura y simple.
 */
export function formatPrice(priceCents: number, currency: string, locale = 'es-AR'): string {
  if (priceCents === 0) return 'Gratis'
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(priceCents / 100)
}
