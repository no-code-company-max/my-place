'use client'

import { useCallback } from 'react'
import { CommentComposer } from '@/features/rich-text/composers/public'
import type { LexicalDocument, MentionUserResult } from '@/features/rich-text/public'
import { searchMembersByPlaceAction } from '@/features/members/public'
import { searchEventsByPlaceAction } from '@/features/events/public'
import {
  listLibraryCategoriesForMentionAction,
  searchLibraryItemsForMentionAction,
} from '@/features/library/public'
import { createCommentAction } from '../server/actions/comments'

/**
 * Wrapper client del `<CommentComposer>` adaptado al server action de
 * `createCommentAction`. Inyecta los 4 resolvers de mention: `@user`,
 * `/event`, `/library` (categoría → items). Sin los 3 últimos, los
 * triggers `/event` y `/library` quedan inertes en el composer del thread
 * — bug histórico hasta esta sesión.
 */
export function CommentComposerForm({
  placeId,
  postId,
}: {
  placeId: string
  postId: string
}): React.JSX.Element {
  const searchUsers = useCallback(
    async (q: string): Promise<MentionUserResult[]> => {
      const rows = await searchMembersByPlaceAction(placeId, q)
      return rows.map((r) => ({
        userId: r.userId,
        displayName: r.displayName,
        handle: r.handle,
      }))
    },
    [placeId],
  )

  const searchEvents = useCallback(
    async (q: string) => searchEventsByPlaceAction(placeId, q),
    [placeId],
  )

  const listCategories = useCallback(
    async () => listLibraryCategoriesForMentionAction(placeId),
    [placeId],
  )

  const searchLibraryItems = useCallback(
    async (categorySlug: string, q: string) =>
      searchLibraryItemsForMentionAction(placeId, categorySlug, q),
    [placeId],
  )

  const onSubmit = useCallback(
    async (body: LexicalDocument) => {
      const res = await createCommentAction({ postId, body })
      if (!res.ok) throw new Error('No pudimos publicar el comentario.')
    },
    [postId],
  )

  return (
    <CommentComposer
      placeId={placeId}
      onSubmit={onSubmit}
      searchUsers={searchUsers}
      searchEvents={searchEvents}
      listCategories={listCategories}
      searchLibraryItems={searchLibraryItems}
    />
  )
}
