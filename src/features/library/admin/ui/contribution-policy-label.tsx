import type { ContributionPolicy } from '@/features/library/public'

/**
 * Label corto user-facing para una `ContributionPolicy`. Útil en
 * listado admin + form selector.
 *
 * Owner siempre puede contribuir sin importar la policy (decisión #C ADR
 * 2026-05-04 — el copy lo refleja diciendo "además del owner").
 */
export function contributionPolicyLabel(policy: ContributionPolicy): string {
  switch (policy) {
    case 'DESIGNATED':
      return 'Personas designadas'
    case 'MEMBERS_OPEN':
      return 'Cualquier miembro'
    case 'SELECTED_GROUPS':
      return 'Grupo seleccionado'
  }
}

/**
 * Descripción larga para el form (helper text bajo el dropdown).
 */
export function contributionPolicyDescription(policy: ContributionPolicy): string {
  switch (policy) {
    case 'DESIGNATED':
      return 'Solo los miembros que vos designes pueden agregar contenido (además del owner).'
    case 'MEMBERS_OPEN':
      return 'Cualquier miembro del place puede agregar contenido en esta categoría.'
    case 'SELECTED_GROUPS':
      return 'Solo los miembros de los grupos que asignes pueden agregar contenido (además del owner).'
  }
}
