/**
 * API pública del sub-slice `discussions/editor/`.
 *
 * UI de composición + edición + render TipTap. Reusable cross-slice
 * (library/items la usa para items de biblioteca).
 */

export { PostComposer } from './ui/post-composer'
export { RichTextEditor } from './ui/rich-text-editor'
export { RichTextRenderer } from './ui/rich-text-renderer'
export { EditWindowActions } from './ui/edit-window-actions'
export { EditWindowConfirmDelete } from './ui/edit-window-confirm-delete'
export { EditWindowForm } from './ui/edit-window-form'
export type {
  CommentSubject,
  EditSessionState,
  EditWindowSubject,
  PostSubject,
} from './ui/edit-window-types'
