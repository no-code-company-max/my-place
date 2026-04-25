/**
 * Mapping de RSVPState → copy visible. Centralizado para garantizar
 * consistencia entre `RSVPButton`, `RsvpList`, `EventListItem` y
 * `EventDetail`.
 *
 * Ver `docs/features/events/spec-rsvp.md § 2`.
 */

import type { RSVPState } from '../domain/types'

const LABELS: Record<RSVPState, string> = {
  GOING: 'Voy',
  GOING_CONDITIONAL: 'Voy si…',
  NOT_GOING_CONTRIBUTING: 'No voy, pero aporto…',
  NOT_GOING: 'No voy',
}

const TEXTFIELD_LABELS: Partial<Record<RSVPState, { label: string; placeholder: string }>> = {
  GOING_CONDITIONAL: {
    label: '¿Qué necesitarías?',
    placeholder: 'Si llego del trabajo a tiempo / si me organizo con auto',
  },
  NOT_GOING_CONTRIBUTING: {
    label: '¿Cómo aportás?',
    placeholder: 'Llevo el vino / mando link de Spotify / paso receta',
  },
}

export function rsvpLabel(state: RSVPState): string {
  return LABELS[state]
}

export function rsvpTextfieldHints(
  state: RSVPState,
): { label: string; placeholder: string } | null {
  return TEXTFIELD_LABELS[state] ?? null
}

export function rsvpAcceptsNote(state: RSVPState): boolean {
  return state === 'GOING_CONDITIONAL' || state === 'NOT_GOING_CONTRIBUTING'
}

/** Estados ordenados como aparecen en el RSVPButton (de "voy" a "no voy"). */
export const RSVP_BUTTON_ORDER: readonly RSVPState[] = [
  'GOING',
  'GOING_CONDITIONAL',
  'NOT_GOING_CONTRIBUTING',
  'NOT_GOING',
]
