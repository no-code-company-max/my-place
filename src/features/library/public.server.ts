import 'server-only'

/**
 * Superficie pública server-only del slice `library`. Queries Prisma
 * y helpers que nunca deben viajar al bundle cliente.
 *
 * Server Components y server actions consumen acá; Client Components
 * consumen solo `public.ts`. Ver
 * `docs/decisions/2026-04-21-flags-subslice-split.md` § "Boundary
 * client vs server".
 */

export {
  countLibraryCategories,
  findItemBySlug,
  findItemForAction,
  findLibraryCategoryById,
  findLibraryCategoryBySlug,
  listItemsByCategory,
  listLibraryCategories,
  listRecentItems,
  type ListLibraryCategoriesOptions,
} from './server/queries'

// Helpers de revalidate y resolución de viewer — usados por Server
// Components y server actions cross-slice (ej: features/shell/).
export { revalidateLibraryCategoryPaths, revalidateLibraryItemPaths } from './server/actions/shared'
export { resolveLibraryViewer, type LibraryViewerContext } from './server/viewer'

// F.4 (rich-text): autocomplete `/library/<cat>/<item>` two-step para
// composers (Post / Library / Event) + lookup defensivo de mention al render.
export {
  listCategoriesForMention,
  searchLibraryItems,
  findLibraryItemForMention,
  type MentionLibraryCategory,
  type MentionLibraryItem,
} from './server/mention-search'
