/**
 * API pública del sub-slice `library/embeds/`.
 *
 * Embeds = TipTap custom node para insertar referencias externas
 * (videos, docs, links) intercaladas en el body de un item de biblioteca.
 *
 * Boundary: cualquier consumer fuera de embeds/ (incluido el parent
 * `library/` raíz y siblings `items/` / `admin/`) importa SOLO desde
 * acá. Imports internos del sub-slice usan paths relativos.
 *
 * Plan: docs/plans/2026-05-04-library-root-sub-split-and-cap-enforcement.md
 * ADR:  docs/decisions/2026-05-04-library-root-sub-split.md
 */

// ---------------------------------------------------------------
// Domain — parser puro de URL → provider + metadata
// ---------------------------------------------------------------

export {
  EMBED_PROVIDERS,
  parseEmbedUrl,
  type EmbedProvider,
  type ParsedEmbed,
} from './domain/embed-parser'

// ---------------------------------------------------------------
// UI — TipTap extension + node-view + toolbar
// ---------------------------------------------------------------

export { EmbedNodeExtension } from './ui/embed-node/extension'
export { EmbedNodeView } from './ui/embed-node/node-view'
export { EmbedToolbar } from './ui/embed-toolbar'
