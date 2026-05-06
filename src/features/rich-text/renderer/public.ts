/**
 * Superficie pública client-safe del sub-slice `rich-text/renderer`.
 *
 * Sólo el renderer client (síncrono, sin resolvers async). El renderer SSR
 * con resolvers async vive en `public.server.ts` para no contaminar el
 * bundle cliente con `import 'server-only'` (ver gotcha en CLAUDE.md
 * sobre split `public.ts` + `public.server.ts`).
 */

export { RichTextRendererClient } from './ui/renderer-client'
