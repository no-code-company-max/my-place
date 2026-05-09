import { MenuOption } from '@lexical/react/LexicalTypeaheadMenuPlugin'
import type { MenuPayload } from './mention-types'

/**
 * Wrapper de `MenuOption` (Lexical) que carga el `MenuPayload` discriminado.
 * Extraído de `mention-plugin.tsx` durante el split — la clase + `MAX_RESULTS`
 * son tightly-coupled (siempre se usan juntos al construir options).
 */

export const MAX_RESULTS = 8

export class GenericMenuOption extends MenuOption {
  payload: MenuPayload
  constructor(payload: MenuPayload) {
    super(payload.id)
    this.payload = payload
  }
}
