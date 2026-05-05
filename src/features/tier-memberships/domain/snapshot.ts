/**
 * Builder puro para `AssignedBySnapshot` — snapshot del assigner congelado
 * al momento de asignar el tier.
 *
 * Patrón canónico de erasure 365d (Post/Comment/Flag/Event):
 *  - El JSON inline preserva el dato histórico.
 *  - Si el assigner pasa por erasure, su `User.displayName` se renombra a
 *    "ex-miembro" pero este snapshot queda intacto.
 *
 * Ver `docs/decisions/2026-04-24-erasure-365d.md` § "Snapshots" y
 * `docs/decisions/2026-05-02-tier-memberships-model.md` § decisión 5.
 */

import type { AssignedBySnapshot } from './types'

/**
 * Construye el snapshot a partir del shape de `findUserProfile`
 * (`@/shared/lib/identity-cache`). Pure — sin side effects, sin imports
 * server-only.
 *
 * `displayName` es required (lo garantiza el modelo `User`); `avatarUrl`
 * puede ser `null` (usuario sin avatar).
 */
export function buildAssignedBySnapshot(user: {
  displayName: string
  avatarUrl: string | null
}): AssignedBySnapshot {
  return {
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
  }
}
