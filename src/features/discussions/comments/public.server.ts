import 'server-only'

/** API server-only del sub-slice discussions/comments/. */

export {
  COMMENT_PAGE_SIZE,
  findCommentById,
  listCommentsByPost,
  type CommentView,
} from './server/queries/comments'
