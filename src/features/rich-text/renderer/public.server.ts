import 'server-only'

/**
 * Superficie server-only del sub-slice `rich-text/renderer`. El SSR
 * importa `'server-only'` directo (resolvers de mention pueden tirar
 * queries Prisma).
 */

export { RichTextRenderer } from './ui/renderer'
export type { MentionResolvers } from './ui/renderer'
