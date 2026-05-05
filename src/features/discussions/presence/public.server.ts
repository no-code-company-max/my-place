import 'server-only'

/**
 * API server-only del sub-slice `discussions/presence/`.
 *
 * Queries Prisma de presence (post-readers + place-opening). Server
 * Components y actions consumen acá; UI cliente sólo `public.ts`.
 */

export { findOrCreateCurrentOpening } from './server/place-opening'

export {
  fetchCommentCountByPostId,
  fetchLastReadByPostId,
  fetchReadersSampleByPostId,
  listReadersByPost,
  type PostReader,
} from './server/queries/post-readers'
