import 'server-only'

/**
 * Superficie server-only del slice `rich-text`.
 *
 * Re-exporta el server-public del sub-slice `renderer/` (renderer SSR
 * async con resolvers que pueden ejecutar queries Prisma). El split
 * client/server espeja el patrón de `flags/` y `discussions/` (ADR
 * `2026-04-21-flags-subslice-split.md`).
 */

export { RichTextRenderer } from './renderer/public.server'
export type { MentionResolvers } from './renderer/public.server'
