/**
 * Helper puro para calcular la fecha de expiración de un `TierMembership`.
 *
 * Sin Prisma, sin Next. Tree-shakeable: tanto Server Actions como tests
 * unit lo consumen sin atravesar el boundary de servidor.
 *
 * Ver `docs/features/tier-memberships/spec.md` § 11 y ADR § 3.
 */

import { tierDurationToDays, type TierDuration } from '@/features/tiers/public'

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Calcula `expiresAt` para una asignación nueva.
 *
 * - `indefinite = true`  → `null` (vive hasta que el owner la remueva).
 * - `indefinite = false` → `assignedAt + tierDurationToDays(duration) * 1 día`.
 *
 * Convenciones de duración (`tierDurationToDays`):
 *  ONE_MONTH = 30 días, THREE_MONTHS = 90 días, etc. Cuando llegue Stripe,
 *  el cálculo real lo hace Stripe vía `interval + interval_count` — este
 *  helper sólo se usa para la asignación manual del owner.
 */
export function computeExpiresAt(
  assignedAt: Date,
  duration: TierDuration,
  indefinite: boolean,
): Date | null {
  if (indefinite) return null
  const days = tierDurationToDays(duration)
  return new Date(assignedAt.getTime() + days * MS_PER_DAY)
}
