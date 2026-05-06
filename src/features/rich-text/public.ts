/**
 * Superficie pública del slice `rich-text`.
 *
 * Barrel general: agrega los `public.ts` de los sub-slices internos
 * (`mentions/`, `composers/`, `renderer/`, `embeds/` se importa directo
 * por consumers que activan embeds — no se re-exporta acá) más los
 * primitivos del dominio (`domain/`).
 *
 * Sólo exports client-safe + tipos. Server-only (renderer SSR async,
 * resolvers de mention con queries Prisma) viven en `public.server.ts`.
 * Ver gotcha sobre split público en CLAUDE.md.
 *
 * Cada sub-slice tiene su propio cap 1500 LOC; el split honesto reemplaza
 * la excepción provisoria que existió post-migración TipTap → Lexical.
 */

// ---------------------------------------------------------------
// Sub-slices del slice `rich-text`
// ---------------------------------------------------------------

// Mentions: `MentionNode` + plugin polimórfico (`@`, `/event`, `/library`).
export {
  MentionNode as MentionLexicalNode,
  $createMentionNode,
  $isMentionNode,
} from './mentions/public'
export type {
  ComposerMentionResolvers,
  MentionEventResult,
  MentionKind,
  MentionLibraryCategoryResult,
  MentionLibraryItemResult,
  MentionPayload,
  MentionResolversForEditor,
  MentionUserResult,
} from './mentions/public'

// Composers: 4 surfaces + base.
export {
  BaseComposer,
  CommentComposer,
  EventComposer,
  LibraryItemComposer,
  PostComposer,
} from './composers/public'
export type {
  BaseComposerProps,
  CommentComposerProps,
  ComposerSurface,
  EnabledEmbeds,
  EventComposerProps,
  LibraryItemComposerProps,
  PostComposerProps,
} from './composers/public'

// Renderer client-safe (el SSR vive en `public.server.ts`).
export { RichTextRendererClient } from './renderer/public'

// ---------------------------------------------------------------
// Domain primitives (siguen viviendo en `domain/`, comunes a todos
// los sub-slices del rich-text — no son un sub-slice por sí mismos).
// ---------------------------------------------------------------

export type {
  ApplePodcastEmbed,
  BlockNode,
  CommentDocument,
  ElementDirection,
  ElementFormat,
  EmbedNode,
  EventDocument,
  HeadingNode,
  InlineNode,
  IvooxEmbed,
  LexicalDocument,
  LibraryItemDocument,
  LineBreakNode,
  LinkNode,
  ListItemNode,
  ListNode,
  MentionNode,
  ParagraphNode,
  PostDocument,
  QuoteSnapshot,
  RootNode,
  SpotifyEmbed,
  TextNode,
  YoutubeEmbed,
} from './domain/types'

export {
  applePodcastEmbedSchema,
  commentDocumentSchema,
  embedNodeSchema,
  eventDocumentSchema,
  headingNodeSchema,
  ivooxEmbedSchema,
  libraryItemDocumentSchema,
  lineBreakNodeSchema,
  linkNodeSchema,
  listItemNodeSchema,
  listNodeSchema,
  mentionNodeSchema,
  paragraphNodeSchema,
  postDocumentSchema,
  richTextDocumentSchema,
  rootNodeSchema,
  spotifyEmbedSchema,
  textNodeSchema,
  youtubeEmbedSchema,
} from './domain/schemas'

export {
  RICH_TEXT_MAX_BYTES,
  RICH_TEXT_MAX_LIST_DEPTH,
  assertRichTextSize,
  richTextByteSize,
  richTextMaxListDepth,
} from './domain/size'

export type { AssertRichTextSizeOpts } from './domain/size'

export { RichTextTooDeepError, RichTextTooLargeError } from './domain/errors'

export { richTextExcerpt } from './domain/excerpt'

export { buildQuoteSnapshot } from './domain/snapshot'
export type { BuildQuoteSnapshotInput } from './domain/snapshot'
