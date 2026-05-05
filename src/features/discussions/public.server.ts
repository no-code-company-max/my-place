import 'server-only'

/**
 * Superficie pública server-only del slice `discussions`. Los consumidores
 * client-safe siguen viviendo en `public.ts`; lo que importa Prisma
 * directamente (hard delete polimórfico) sale por acá para que el bundler de
 * Next no lo trace al bundle cliente. Ver
 * `docs/decisions/2026-04-21-flags-subslice-split.md` §"Boundary client vs
 * server".
 */

export { hardDeletePost } from './server/hard-delete'

// Helper transaccional para que slices vecinos (events) puedan crear un Post
// como thread asociado bajo la misma tx que su objeto raíz. Ver
// docs/features/events/spec-integrations.md § 1.2.
export {
  createPostFromSystemHelper,
  type CreatePostFromSystemInput,
} from './server/actions/posts/create-from-system'

// Resolución del actor con membership activa, expuesta para que otros slices
// (events) reusen la lógica de gate sin reimplementar (membership +
// ownership + place archivado check, todo cached por request). El nombre
// `DiscussionActor` es legacy del slice donde fue introducido — el shape
// es genérico y el alias `Viewer` lo refleja. Ver
// `docs/decisions/2026-04-20-request-scoped-identity-cache.md`.
export {
  resolveActorForPlace,
  resolveViewerForPlace,
  type DiscussionActor,
  type DiscussionViewer,
} from './server/actor'

// Queries Prisma + page size constants. Viven server-only porque
// importan `import 'server-only'` directo o transitivo. Cualquier
// Server Component / Server Action que las necesite las consume desde
// este barrel; Client Components pasan por `public.ts` (sin queries).
export {
  COMMENT_PAGE_SIZE,
  POST_PAGE_SIZE,
  findCommentById,
  findPostById,
  findPostBySlug,
  listCommentsByPost,
  listPostsByPlace,
  listReadersByPost,
  type CommentView,
  type PostReader,
} from './server/queries'

export {
  aggregateReactions,
  reactionMapKey,
  type AggregatedReaction,
  type ReactionAggregationMap,
} from './server/reactions-aggregation'

export { findOrCreateCurrentOpening } from './server/place-opening'

// Server Components que importan queries/aggregation server-only directo.
// No pueden viajar via `public.ts` porque Next traza los imports al bundle
// del cliente cuando algún Client Component los importa transitivamente.
export { CommentThread } from './ui/comment-thread'
export { PostDetail } from './ui/post-detail'
export { PostList } from './ui/post-list'
export { PostReadersBlock } from './ui/post-readers-block'
