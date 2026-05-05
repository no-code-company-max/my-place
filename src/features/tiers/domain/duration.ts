/**
 * Helpers puros sobre `TierDuration` (T.2).
 *
 * Funciones puras — sin Prisma, sin Next. Tree-shakeable: las
 * Client Components pueden importarlas directamente sin arrastrar
 * código de servidor.
 *
 * Ver `docs/features/tiers/spec.md` § 2 + ADR § 6.
 */

import type { TierDuration } from './types'

/**
 * Días concretos de cada duración. Mapeos canónicos para cálculos de
 * expiración futuros (cuando llegue `TierMembership` v2).
 *
 * Convenciones:
 * - `ONE_MONTH = 30 días` (no 30.44 ni "calendar month"). Decisión
 *   simplificadora — cuando llegue Stripe el cálculo real lo hace
 *   Stripe vía `interval='month' + interval_count=1`.
 * - `THREE_MONTHS = 90 días`, `SIX_MONTHS = 180 días`, `ONE_YEAR = 365 días`.
 */
const DAYS_BY_DURATION: Record<TierDuration, number> = {
  SEVEN_DAYS: 7,
  FIFTEEN_DAYS: 15,
  ONE_MONTH: 30,
  THREE_MONTHS: 90,
  SIX_MONTHS: 180,
  ONE_YEAR: 365,
}

export function tierDurationToDays(duration: TierDuration): number {
  return DAYS_BY_DURATION[duration]
}

/**
 * Label user-facing en español de la duración. Usado en `<TierCard>` y en
 * el `<TierFormDialog>` para los radio/select. Mantenido acá (no en `ui/`)
 * para que sea reusable desde Server Components y tests sin atravesar
 * el boundary client.
 */
const LABEL_BY_DURATION: Record<TierDuration, string> = {
  SEVEN_DAYS: '7 días',
  FIFTEEN_DAYS: '15 días',
  ONE_MONTH: '1 mes',
  THREE_MONTHS: '3 meses',
  SIX_MONTHS: '6 meses',
  ONE_YEAR: '1 año',
}

export function tierDurationLabel(duration: TierDuration): string {
  return LABEL_BY_DURATION[duration]
}
