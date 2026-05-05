/**
 * API pública del sub-slice `discussions/posts/`.
 *
 * Server Actions de Post (create/edit/delete/moderate) + create-from-system
 * helper interno para sub-slices que crean posts (events, library/items).
 */

export {
  createPostAction,
  deletePostAction,
  editPostAction,
  hidePostAction,
  openPostEditSession,
  unhidePostAction,
} from './server/actions'
