import 'server-only'

/** Barrel residual — posts y comments queries viven en sus sub-slices. */

export {
  COMMENT_PAGE_SIZE,
  findCommentById,
  listCommentsByPost,
  type CommentView,
} from '@/features/discussions/comments/public.server'
