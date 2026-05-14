import 'server-only'

/**
 * API pública server-only del sub-slice `library/courses`.
 *
 * Queries Prisma:
 * - `listCompletedItemIdsByUser(userId, placeId)` cacheable React.cache
 *   (perf-critical: el listing de items la consume 1 vez por render).
 * - `findItemPrereqChain(itemId, allItems)` función pura para mostrar
 *   la cadena de prereqs en UI cuando un item está locked.
 *
 * Server Components y pages importan de acá. Client Components importan
 * sólo de `@/features/library/courses/public`.
 */

export {
  findItemPrereqChain,
  listCategoryItemsForPrereqLookup,
  listCompletedItemIdsByUser,
  type CategoryItemForPrereqLookup,
  type ItemForPrereqChain,
} from './server/queries'
