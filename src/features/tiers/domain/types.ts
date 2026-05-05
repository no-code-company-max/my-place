/**
 * Tipos del dominio del slice `tiers` (T.2).
 *
 * Tipos puros — sin Prisma, sin Next, sin React. La query mapea la row
 * de Prisma a este shape; las actions y la UI consumen estos tipos.
 *
 * Los nombres de los enums espejean los enums Postgres (creados en
 * migration `20260502000000_tiers_core_schema`). El array de valores
 * canónicos (`TIER_DURATION_VALUES`, `TIER_VISIBILITY_VALUES`) se usa
 * para validación Zod y para iterar opciones en la UI.
 *
 * Ver `docs/features/tiers/spec.md` § 2 + § 8.
 */

/**
 * Duración del tier — período de validez antes de renovarse. Enum cerrado
 * de 6 valores canónicos (decisión #6 del ADR). Helper puro
 * `tierDurationToDays()` deriva días concretos. Cuando llegue Stripe
 * Connect, cada valor mapea a `interval` + `interval_count`.
 */
export type TierDuration =
  | 'SEVEN_DAYS'
  | 'FIFTEEN_DAYS'
  | 'ONE_MONTH'
  | 'THREE_MONTHS'
  | 'SIX_MONTHS'
  | 'ONE_YEAR'

export const TIER_DURATION_VALUES: ReadonlyArray<TierDuration> = [
  'SEVEN_DAYS',
  'FIFTEEN_DAYS',
  'ONE_MONTH',
  'THREE_MONTHS',
  'SIX_MONTHS',
  'ONE_YEAR',
]

/**
 * Visibilidad del tier. Binaria — sin estados intermedios (decisión #2 ADR).
 *
 * - `PUBLISHED`: visible en pricing pages futuros (member visibles).
 * - `HIDDEN`: oculto a members; el owner sigue viéndolo en
 *   `/settings/tiers` para editarlo o re-publicarlo.
 *
 * Default al crear: `HIDDEN` (los tiers nuevos arrancan ocultos).
 */
export type TierVisibility = 'PUBLISHED' | 'HIDDEN'

export const TIER_VISIBILITY_VALUES: ReadonlyArray<TierVisibility> = ['PUBLISHED', 'HIDDEN']

/**
 * Currency v1 hardcoded. Allowlist se extiende cuando llegue Stripe Connect
 * (USD/BRL/MXN para LATAM — ARS no está soportado). Schema reserva el
 * campo `String @db.VarChar(3)` para que el modelo no cambie entonces.
 */
export type TierCurrency = 'USD'

export const TIER_CURRENCY_VALUES: ReadonlyArray<TierCurrency> = ['USD']

/**
 * Vista canónica del tier. 1:1 con la row de la tabla `Tier` (sin
 * computed fields v1). Identidad es el `id` cuid — el `name` NO es
 * único (decisión #11 ADR).
 *
 * `priceCents = 0` ⇒ tier gratis. `priceCents > 0` ⇒ tier de pago
 * (sin cobro automático en v1, solo definición).
 */
export type Tier = {
  id: string
  placeId: string
  name: string
  description: string | null
  priceCents: number
  currency: TierCurrency
  duration: TierDuration
  visibility: TierVisibility
  createdAt: Date
  updatedAt: Date
}
