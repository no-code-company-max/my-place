import 'server-only'

/**
 * API pública server-only del slice `editor-config`. Queries Prisma +
 * helpers cacheados que nunca deben viajar al bundle cliente.
 *
 * Pages/Server Components consumen acá; Client Components consumen
 * `public.ts`. Mismo patrón que `places/`, `hours/` y `flags/`.
 */

export { getEditorConfigForPlace, editorConfigCacheTag } from './server/queries'
