'use client'

import type { ReactNode } from 'react'
import type { CommentView } from '../server/queries'
import type { AggregatedReaction } from '../server/reactions-aggregation'
import { CommentItemClient } from './comment-item-client'
import { useCommentRealtime } from './use-comment-realtime'

/**
 * Sub-componente que ejecuta el hook `useCommentRealtime` (subscribe a
 * `comment_created` broadcast vía Supabase Realtime) y renderiza los
 * comments appendeados.
 *
 * Vive en archivo separado de `<CommentThreadLive>` para poder
 * lazy-cargarlo via `React.lazy`. El chunk con Supabase Realtime +
 * GoTrue (~12-15 kB gzip) sólo viaja al cliente post-FCP, en idle.
 *
 * Los comments appendeados muestran `reactions=[]` — el próximo
 * `revalidatePath` trae counts reales via SSR.
 */
export function CommentRealtimeAppender({
  postId,
  initialItems,
}: {
  postId: string
  initialItems: CommentView[]
}): ReactNode {
  const { appendedComments } = useCommentRealtime({ postId, initialItems })

  return (
    <>
      {appendedComments.map((comment) => (
        <CommentItemClient key={comment.id} comment={comment} reactions={EMPTY_REACTIONS} />
      ))}
    </>
  )
}

const EMPTY_REACTIONS: AggregatedReaction[] = []
