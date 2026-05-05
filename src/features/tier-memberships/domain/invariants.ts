/**
 * Invariantes del slice `tier-memberships` (M.2).
 *
 * Funciones puras — sin Prisma, sin Next, sin React. Las server actions las
 * llaman como defensa en profundidad después de cargar los rows necesarios
 * (target membership + tier).
 *
 * NO tiran `ValidationError`: estos checks reflejan errores **esperados**
 * del flujo (tier oculto, target ya no es miembro). El caller los mapea a
 * un discriminated union return — gotcha CLAUDE.md 2026-05-02. Por eso
 * retornan boolean en vez de throw.
 *
 * Ver `docs/features/tier-memberships/spec.md` § 10 + § 13 y ADR § 4.
 */

import type { TierVisibility } from '@/features/tiers/public'

/**
 * `true` si el tier puede asignarse — sólo `PUBLISHED`. Asignaciones a
 * tiers HIDDEN están explícitamente prohibidas (decisión #4 ADR). Las
 * asignaciones existentes a un tier que pasa a HIDDEN siguen vigentes —
 * este check sólo aplica al **crear** una asignación nueva.
 */
export function isTierAssignable(visibility: TierVisibility): boolean {
  return visibility === 'PUBLISHED'
}

/**
 * `true` si el target user es un miembro **activo** del place. La función
 * acepta cualquier shape no-null/undefined — su mera existencia implica
 * activo en el caso del helper `findActiveMembership`
 * (`@/shared/lib/identity-cache`), que ya filtra `leftAt: null` en su WHERE.
 *
 * Si el caller pasa un shape con `leftAt` (ej: row crudo de Prisma para
 * tests directos), también lo respeta.
 *
 * Asignar tiers a ex-miembros está prohibido — discriminated union devuelve
 * `target_user_not_member`.
 */
export function isActiveMembership(membership: unknown): boolean {
  if (membership === null || membership === undefined) return false
  if (typeof membership !== 'object') return false
  // Si el shape expone `leftAt`, lo respetamos. Si no, la mera existencia
  // del row implica que el caller (típicamente `findActiveMembership`) ya
  // filtró por `leftAt: null` en el WHERE.
  if ('leftAt' in membership) {
    const leftAt = (membership as { leftAt: unknown }).leftAt
    return leftAt === null
  }
  return true
}
