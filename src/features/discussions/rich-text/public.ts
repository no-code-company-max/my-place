/**
 * API pública del sub-slice `discussions/rich-text/`.
 *
 * Schemas Zod del TipTap AST + helpers numéricos (byte size, max depth,
 * excerpt). Sub-slice vertical que cubre la validación + medición del
 * documento — sin UI, sin server. Reusable potencial fuera de discussions.
 *
 * ADR: docs/decisions/2026-05-04-library-root-sub-split.md (decisión meta).
 */

export { richTextDocumentSchema, type RichTextDocumentParsed } from './domain/rich-text-schemas'

export {
  RICH_TEXT_MAX_BYTES,
  RICH_TEXT_MAX_LIST_DEPTH,
  assertRichTextSize,
  richTextByteSize,
  richTextExcerpt,
  richTextMaxListDepth,
} from './domain/rich-text'
