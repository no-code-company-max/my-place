import 'server-only'
import type { LexicalDocument } from '@/features/rich-text/public'

/**
 * Construye el cuerpo Lexical inicial del thread asociado a un evento.
 *
 * Cuerpo mínimo: un paragraph con el texto introductorio. Si hay
 * `description` del evento, NO se duplica acá (queda en el detalle del
 * evento; el thread es para conversación, no para repetir el invitation).
 *
 * Ver `docs/features/events/spec-integrations.md § 1.4`.
 */
export function buildEventThreadIntroBody(event: { id: string; title: string }): LexicalDocument {
  return {
    root: {
      type: 'root',
      version: 1,
      format: '',
      indent: 0,
      direction: 'ltr',
      children: [
        {
          type: 'paragraph',
          version: 1,
          format: '',
          indent: 0,
          direction: 'ltr',
          textFormat: 0,
          textStyle: '',
          children: [
            {
              type: 'text',
              version: 1,
              text: `Conversación del evento "${event.title}". Acá coordinamos lo que haga falta.`,
              format: 0,
              detail: 0,
              mode: 'normal',
              style: '',
            },
          ],
        },
      ],
    },
  }
}
