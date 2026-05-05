import 'server-only'

/**
 * API server-only del sub-slice `library/contributors/`.
 *
 * Queries Prisma de listados de contributors (designated por categoría).
 * Server Components y actions consumen acá; UI cliente NO.
 */

export {
  canCreateInAnyCategoryForViewer,
  listCategoryContributors,
  listCategoryContributorUserIds,
  listContributorsByCategoryIds,
} from './server/queries'
