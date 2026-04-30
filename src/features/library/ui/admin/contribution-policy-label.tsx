import type { ContributionPolicy } from '@/features/library/public'

/**
 * Label corto user-facing para una `ContributionPolicy`. Útil en
 * listado admin + form selector.
 */
export function contributionPolicyLabel(policy: ContributionPolicy): string {
  switch (policy) {
    case 'ADMIN_ONLY':
      return 'Solo admins'
    case 'DESIGNATED':
      return 'Personas designadas'
    case 'MEMBERS_OPEN':
      return 'Cualquier miembro'
  }
}

/**
 * Descripción larga para el form (helper text bajo el dropdown).
 */
export function contributionPolicyDescription(policy: ContributionPolicy): string {
  switch (policy) {
    case 'ADMIN_ONLY':
      return 'Solo admins y owner pueden agregar contenido en esta categoría.'
    case 'DESIGNATED':
      return 'Solo los miembros que vos designes pueden agregar contenido (además de admins).'
    case 'MEMBERS_OPEN':
      return 'Cualquier miembro del place puede agregar contenido en esta categoría.'
  }
}
