'use client'

import type { ReactNode } from 'react'
import type { CommentView } from '@/features/discussions/comments/server/queries/comments'
import type { AggregatedReaction } from '@/features/discussions/reactions/public'
import { CommentItem } from './comment-item'
import { useCommentRealtime } from './use-comment-realtime'

/**
 * Wrapper client-side del thread: renderiza los items SSR como `children` y
 * appendea comments nuevos recibidos por `comment_created` broadcast (ver
 * `use-comment-realtime.ts` + `server/realtime.ts`).
 *
 * Los comments appendeados muestran `reactions=[]` (no llegan agregadas en el
 * broadcast) — el próximo `revalidatePath` las trae via SSR. El mapeo de
 * reacciones en streaming sería un PR aparte.
 *
 * Render de SSR (`children`) NO se re-renderiza en el cliente: el wrapper
 * solo coloca los nuevos debajo. Esto preserva reacciones ya agregadas.
 */
export function CommentThreadLive({
  postId,
  placeSlug,
  viewerUserId,
  viewerIsAdmin,
  initialItems,
  children,
}: {
  postId: string
  placeSlug: string
  viewerUserId: string
  viewerIsAdmin: boolean
  initialItems: CommentView[]
  children: ReactNode
}): React.ReactNode {
  const { appendedComments } = useCommentRealtime({ postId, initialItems })

  return (
    <>
      {children}
      {appendedComments.map((comment) => (
        <CommentItem
          key={comment.id}
          comment={comment}
          placeSlug={placeSlug}
          viewerUserId={viewerUserId}
          viewerIsAdmin={viewerIsAdmin}
          reactions={EMPTY_REACTIONS}
        />
      ))}
    </>
  )
}

const EMPTY_REACTIONS: AggregatedReaction[] = []
