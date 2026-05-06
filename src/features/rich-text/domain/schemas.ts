/**
 * Schemas Zod del Lexical AST + subsets por surface.
 *
 * Contrato runtime que valida la forma del documento al persistir/leer.
 * Acompañado por los tipos en `types.ts` y por los caps en `size.ts`.
 *
 * Por surface: el AST general acepta TODOS los nodos del subset del producto;
 * los schemas por-surface (`commentDocumentSchema`, etc.) usan un refine que
 * recorre el árbol y rechaza nodos cuyo `type` no esté en la allowlist.
 *
 * Heading levels limitados a h1-h3 (no h4-h6) por decisión de producto —
 * el toolbar sólo expone h1/h2/h3.
 */

import { z } from 'zod'

// ---------------------------------------------------------------
// Building blocks (campos compartidos de element nodes)
// ---------------------------------------------------------------

const elementFormatSchema = z.enum(['', 'left', 'start', 'center', 'right', 'end', 'justify'])
const elementDirectionSchema = z.enum(['ltr', 'rtl']).nullable()

// ---------------------------------------------------------------
// Inline nodes
// ---------------------------------------------------------------

export const textNodeSchema = z.object({
  type: z.literal('text'),
  version: z.literal(1),
  text: z.string(),
  // Bitmask de Lexical: bold=1, italic=2, strikethrough=4, underline=8,
  // code=16, subscript=32, superscript=64. Cap superior 1023 = 10 bits
  // (cubre todos los flags + reserva). Lexical persiste flags futuros sin
  // breaking change si caen dentro del bitmask.
  format: z.number().int().min(0).max(1023),
  detail: z.number().int(),
  mode: z.enum(['normal', 'token', 'segmented']),
  style: z.string(),
})

export const mentionNodeSchema = z.object({
  type: z.literal('mention'),
  version: z.literal(1),
  kind: z.enum(['user', 'event', 'library-item']),
  targetId: z.string().min(1),
  targetSlug: z.string().min(1),
  label: z.string().min(1),
  placeId: z.string().min(1),
})

export const lineBreakNodeSchema = z.object({
  type: z.literal('linebreak'),
  version: z.literal(1),
})

export const linkNodeSchema = z.object({
  type: z.literal('link'),
  version: z.literal(1),
  url: z.string().url(),
  rel: z.string().nullable(),
  target: z.string().nullable(),
  title: z.string().nullable(),
  format: elementFormatSchema,
  indent: z.number().int(),
  direction: elementDirectionSchema,
  // Links sólo contienen texto en el subset del producto (sin nested links,
  // sin mentions adentro de un link).
  children: z.array(textNodeSchema),
})

const inlineNodeSchema = z.union([
  textNodeSchema,
  linkNodeSchema,
  mentionNodeSchema,
  lineBreakNodeSchema,
])

// ---------------------------------------------------------------
// Block nodes
// ---------------------------------------------------------------

export const paragraphNodeSchema = z.object({
  type: z.literal('paragraph'),
  version: z.literal(1),
  format: elementFormatSchema,
  indent: z.number().int(),
  direction: elementDirectionSchema,
  textFormat: z.number().int(),
  textStyle: z.string(),
  children: z.array(inlineNodeSchema),
})

export const headingNodeSchema = z.object({
  type: z.literal('heading'),
  version: z.literal(1),
  // h4-h6 prohibidos por subset del producto (spec § "Surfaces").
  tag: z.enum(['h1', 'h2', 'h3']),
  format: elementFormatSchema,
  indent: z.number().int(),
  direction: elementDirectionSchema,
  children: z.array(inlineNodeSchema),
})

// Lista declarada con z.lazy() porque ListItem puede contener ListNode
// recursivamente (listas anidadas).
//
// Anotación: tipamos los schemas como `z.ZodType<ListItemNode>` /
// `z.ZodType<ListNode>` con los shapes del dominio (`types.ts`). Esto
// rompe el ciclo de inferencia que Zod sufre con z.lazy() recursivo.
import type { ListItemNode, ListNode } from './types'

export const listItemNodeSchema: z.ZodType<ListItemNode> = z.lazy(() =>
  z.object({
    type: z.literal('listitem'),
    version: z.literal(1),
    checked: z.boolean().optional(),
    value: z.number().int(),
    format: elementFormatSchema,
    indent: z.number().int(),
    direction: elementDirectionSchema,
    children: z.array(z.union([inlineNodeSchema, listNodeSchema])),
  }),
)

export const listNodeSchema: z.ZodType<ListNode> = z.lazy(() =>
  z.object({
    type: z.literal('list'),
    version: z.literal(1),
    listType: z.enum(['number', 'bullet']),
    start: z.number().int(),
    tag: z.enum(['ul', 'ol']),
    format: elementFormatSchema,
    indent: z.number().int(),
    direction: elementDirectionSchema,
    children: z.array(listItemNodeSchema),
  }),
)

// ---------------------------------------------------------------
// Embeds (DecoratorNodes)
// ---------------------------------------------------------------

export const youtubeEmbedSchema = z.object({
  type: z.literal('youtube'),
  version: z.literal(1),
  videoId: z.string().min(1),
})

export const spotifyEmbedSchema = z.object({
  type: z.literal('spotify'),
  version: z.literal(1),
  kind: z.enum(['track', 'episode', 'show', 'playlist', 'album']),
  externalId: z.string().min(1),
})

export const applePodcastEmbedSchema = z.object({
  type: z.literal('apple-podcast'),
  version: z.literal(1),
  region: z.string().min(1),
  showSlug: z.string().min(1),
  showId: z.string().min(1),
  episodeId: z.string().optional(),
})

export const ivooxEmbedSchema = z.object({
  type: z.literal('ivoox'),
  version: z.literal(1),
  externalId: z.string().min(1),
})

export const embedNodeSchema = z.union([
  youtubeEmbedSchema,
  spotifyEmbedSchema,
  applePodcastEmbedSchema,
  ivooxEmbedSchema,
])

// ---------------------------------------------------------------
// Root + documento
// ---------------------------------------------------------------

const blockNodeSchema = z.union([
  paragraphNodeSchema,
  headingNodeSchema,
  listNodeSchema,
  embedNodeSchema,
])

export const rootNodeSchema = z.object({
  type: z.literal('root'),
  version: z.literal(1),
  format: elementFormatSchema,
  indent: z.literal(0),
  direction: elementDirectionSchema,
  children: z.array(blockNodeSchema),
})

export const richTextDocumentSchema = z.object({
  root: rootNodeSchema,
})

// ---------------------------------------------------------------
// Subsets por surface — restringen qué `type` está permitido
// ---------------------------------------------------------------

/**
 * Recorre el árbol y rechaza si hay un nodo cuyo `type` no esté en la
 * allowlist. Usa el documento ya validado por el schema general — sólo
 * filtra el subset.
 */
function nodeTypesAllowed(allowed: ReadonlyArray<string>) {
  return function walk(node: unknown): boolean {
    if (!node || typeof node !== 'object') return true
    const n = node as { type?: unknown; children?: unknown }
    if (typeof n.type === 'string' && !allowed.includes(n.type) && n.type !== 'root') {
      return false
    }
    if (Array.isArray(n.children)) {
      for (const child of n.children) {
        if (!walk(child)) return false
      }
    }
    return true
  }
}

const COMMENT_ALLOWED: ReadonlyArray<string> = ['paragraph', 'text', 'link', 'mention', 'linebreak']

const POST_ALLOWED: ReadonlyArray<string> = [
  'paragraph',
  'heading',
  'text',
  'link',
  'mention',
  'linebreak',
  'list',
  'listitem',
  'youtube',
  'spotify',
  'apple-podcast',
  'ivoox',
]

const EVENT_ALLOWED: ReadonlyArray<string> = COMMENT_ALLOWED
const LIBRARY_ITEM_ALLOWED: ReadonlyArray<string> = POST_ALLOWED

export const commentDocumentSchema = richTextDocumentSchema.refine(
  (doc) => nodeTypesAllowed(COMMENT_ALLOWED)(doc.root),
  { message: 'El documento contiene nodos no permitidos en este surface (comment).' },
)

export const postDocumentSchema = richTextDocumentSchema.refine(
  (doc) => nodeTypesAllowed(POST_ALLOWED)(doc.root),
  { message: 'El documento contiene nodos no permitidos en este surface (post).' },
)

export const eventDocumentSchema = richTextDocumentSchema.refine(
  (doc) => nodeTypesAllowed(EVENT_ALLOWED)(doc.root),
  { message: 'El documento contiene nodos no permitidos en este surface (event).' },
)

export const libraryItemDocumentSchema = richTextDocumentSchema.refine(
  (doc) => nodeTypesAllowed(LIBRARY_ITEM_ALLOWED)(doc.root),
  { message: 'El documento contiene nodos no permitidos en este surface (library-item).' },
)
