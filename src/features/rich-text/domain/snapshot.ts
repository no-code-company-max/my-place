/**
 * Builder genérico de QuoteSnapshot para el slice rich-text.
 *
 * Es la primitiva agnóstica al dominio: toma un comment con `body` + author
 * label + source label (label del thread/post de origen) y retorna el
 * snapshot congelado para persistir.
 *
 * Los slices consumidores (discussions, library) construyen sus snapshots
 * dominio-específicos sobre esta primitiva. Por ejemplo `discussions` arma
 * su `Comment.quotedSnapshot` con `commentId + authorLabel + bodyExcerpt +
 * createdAt` — no usa `QuoteSnapshot` literal de acá, pero sí reusa
 * `richTextExcerpt` para construir `bodyExcerpt`.
 *
 * Ver `docs/features/rich-text/spec.md` § "Modelo del documento".
 */

import { richTextExcerpt } from './excerpt'
import type { LexicalDocument, QuoteSnapshot } from './types'

const QUOTE_EXCERPT_MAX_CHARS = 280

export type BuildQuoteSnapshotInput = {
  comment: {
    body: LexicalDocument
    authorLabel: string
  }
  sourceLabel: string
}

export function buildQuoteSnapshot(input: BuildQuoteSnapshotInput): QuoteSnapshot {
  return {
    authorLabel: input.comment.authorLabel,
    excerpt: richTextExcerpt(input.comment.body, QUOTE_EXCERPT_MAX_CHARS),
    body: input.comment.body,
    sourceLabel: input.sourceLabel,
  }
}
