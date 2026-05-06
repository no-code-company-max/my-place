/**
 * Tipos del Lexical AST para el slice `rich-text`.
 *
 * Discriminated union derivada del shape canónico que `editor.toJSON()`
 * produce — alineado con `SerializedLexicalNode` y derivados de los
 * paquetes oficiales (`lexical`, `@lexical/rich-text`, `@lexical/list`,
 * `@lexical/link`).
 *
 * El shape lo enforce el schema Zod en `schemas.ts`. Acá vive el contrato
 * estructural — tests de tipos en `__tests__/types.test.ts` verifican que
 * los literales canónicos compilen.
 *
 * Subset por surface (Comment, Post, Event, LibraryItem) son aliases —
 * el subset real lo enforce el schema Zod por surface, no el tipo.
 *
 * Ver `docs/features/rich-text/spec.md` § "Modelo del documento".
 */

// ---------------------------------------------------------------
// Shared element fields (presentes en cualquier ElementNode)
// ---------------------------------------------------------------

/** Alineación horizontal heredada de Lexical. Vacía = default del bloque. */
export type ElementFormat = '' | 'left' | 'start' | 'center' | 'right' | 'end' | 'justify'

/** Dirección del flujo de texto. `null` = no resuelta (Lexical la deduce). */
export type ElementDirection = 'ltr' | 'rtl' | null

// ---------------------------------------------------------------
// Inline nodes
// ---------------------------------------------------------------

/**
 * Nodo de texto. `format` es bitmask: bold=1, italic=2, strikethrough=4,
 * underline=8, code=16, subscript=32 — los toolbars del producto sólo
 * exponen bold/underline (los demás se aceptan en el AST por compat con
 * pastes pero no se ofrecen al usuario).
 */
export type TextNode = {
  type: 'text'
  version: 1
  text: string
  format: number
  detail: number
  mode: 'normal' | 'token' | 'segmented'
  style: string
}

/**
 * Nodo link. En el subset del producto (comment/post/event/library), un link
 * sólo contiene TextNodes (no listas, no headings adentro). El italic CSS
 * automático en links se aplica en el renderer/CSS — no es un `format`.
 */
export type LinkNode = {
  type: 'link'
  version: 1
  url: string
  rel: string | null
  target: string | null
  title: string | null
  format: ElementFormat
  indent: number
  direction: ElementDirection
  children: ReadonlyArray<TextNode>
}

/**
 * Mention polimórfico: un solo nodo `mention` con `kind` discriminante.
 * Snapshot de `targetSlug` + `label` al momento de mencionar — el renderer
 * resuelve el href canónico y aplica fallback `[NO DISPONIBLE]` si el
 * target ya no es visible.
 */
export type MentionNode = {
  type: 'mention'
  version: 1
  kind: 'user' | 'event' | 'library-item'
  targetId: string
  targetSlug: string
  label: string
  placeId: string
}

/** Salto de línea forzado dentro de un bloque (Shift+Enter). */
export type LineBreakNode = {
  type: 'linebreak'
  version: 1
}

/** Cualquier nodo inline aceptado dentro de paragraph/heading/listitem. */
export type InlineNode = TextNode | LinkNode | MentionNode | LineBreakNode

// ---------------------------------------------------------------
// Block (element) nodes
// ---------------------------------------------------------------

export type ParagraphNode = {
  type: 'paragraph'
  version: 1
  format: ElementFormat
  indent: number
  direction: ElementDirection
  textFormat: number
  textStyle: string
  children: ReadonlyArray<InlineNode>
}

/** Heading h1-h3 (h4-h6 prohibidos por el subset del producto). */
export type HeadingNode = {
  type: 'heading'
  version: 1
  tag: 'h1' | 'h2' | 'h3'
  format: ElementFormat
  indent: number
  direction: ElementDirection
  children: ReadonlyArray<InlineNode>
}

/** Item de una lista. `checked` se serializa con valor `undefined` cuando la
 *  lista no es checklist (Lexical conserva la key explícitamente). En MVP
 *  no exponemos checklist al usuario, pero el shape lo tolera. */
export type ListItemNode = {
  type: 'listitem'
  version: 1
  checked?: boolean | undefined
  value: number
  format: ElementFormat
  indent: number
  direction: ElementDirection
  children: ReadonlyArray<InlineNode | ListNode>
}

/** Lista ordenada o no ordenada. `tag = ul | ol` discrimina render. */
export type ListNode = {
  type: 'list'
  version: 1
  listType: 'number' | 'bullet'
  start: number
  tag: 'ul' | 'ol'
  format: ElementFormat
  indent: number
  direction: ElementDirection
  children: ReadonlyArray<ListItemNode>
}

// ---------------------------------------------------------------
// Embed (decorator) nodes
// ---------------------------------------------------------------

export type YoutubeEmbed = {
  type: 'youtube'
  version: 1
  videoId: string
}

export type SpotifyEmbed = {
  type: 'spotify'
  version: 1
  kind: 'track' | 'episode' | 'show' | 'playlist' | 'album'
  externalId: string
}

export type ApplePodcastEmbed = {
  type: 'apple-podcast'
  version: 1
  region: string
  showSlug: string
  showId: string
  /** Opcional con `| undefined` explícito para alinear con la inferencia
   *  de Zod `.optional()` bajo `exactOptionalPropertyTypes: true`. */
  episodeId?: string | undefined
}

export type IvooxEmbed = {
  type: 'ivoox'
  version: 1
  externalId: string
}

export type EmbedNode = YoutubeEmbed | SpotifyEmbed | ApplePodcastEmbed | IvooxEmbed

// ---------------------------------------------------------------
// Bloques permitidos en el RootNode
// ---------------------------------------------------------------

export type BlockNode = ParagraphNode | HeadingNode | ListNode | EmbedNode

export type RootNode = {
  type: 'root'
  version: 1
  format: ElementFormat
  indent: number
  direction: ElementDirection
  children: ReadonlyArray<BlockNode>
}

// ---------------------------------------------------------------
// Documento + alias por surface
// ---------------------------------------------------------------

export type LexicalDocument = {
  root: RootNode
}

/**
 * Alias por surface — el subset real (qué nodos están permitidos) lo enforce
 * el schema Zod, no el tipo TS. Son nominalmente idénticos a `LexicalDocument`
 * y sirven como documentación + para que los call sites declaren intent.
 */
export type CommentDocument = LexicalDocument
export type PostDocument = LexicalDocument
export type EventDocument = LexicalDocument
export type LibraryItemDocument = LexicalDocument

// ---------------------------------------------------------------
// Snapshot de cita
// ---------------------------------------------------------------

/**
 * Snapshot genérico de una cita rich-text. El slice `discussions` lo usa
 * para construir su propio `QuoteSnapshot` (Comment-quoting-Comment) — esta
 * forma es la primitiva del slice rich-text, agnóstica al dominio.
 *
 * `body` se persiste congelado: cualquier edición del comment original NO
 * se refleja en la cita. `excerpt` se trunca al construir.
 */
export type QuoteSnapshot = {
  authorLabel: string
  excerpt: string
  body: LexicalDocument
  sourceLabel: string
}
