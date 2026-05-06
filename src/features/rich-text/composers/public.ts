/**
 * Superficie pública del sub-slice `rich-text/composers`.
 *
 * Agrupa los 4 surface composers (comment, post, event, library-item) +
 * el `BaseComposer` parametrizable. Consumen mentions/embeds vía los
 * `public.ts` de esos sub-slices, no internals.
 */

export { BaseComposer } from './ui/base-composer'
export type { BaseComposerProps, ComposerSurface, EnabledEmbeds } from './ui/base-composer'

export { CommentComposer } from './ui/comment-composer'
export type { CommentComposerProps } from './ui/comment-composer'

export { PostComposer } from './ui/post-composer'
export type { PostComposerProps } from './ui/post-composer'

export { EventComposer } from './ui/event-composer'
export type { EventComposerProps } from './ui/event-composer'

export { LibraryItemComposer } from './ui/library-item-composer'
export type { LibraryItemComposerProps } from './ui/library-item-composer'
