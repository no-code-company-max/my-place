'use client'

import { useEffect, useRef, useState } from 'react'
import type { BroadcastSubscriber } from '@/shared/lib/realtime/client'
import { SupabaseBroadcastSubscriber } from '@/shared/lib/realtime/client'
import { createSupabaseBrowser } from '@/shared/lib/supabase/browser'
import type { CommentView } from '@/features/discussions/comments/server/queries/comments'

/**
 * Hook que escucha broadcasts `comment_created` sobre `post:<postId>` y
 * appendea los comments nuevos al estado local. Convive con SSR inicial:
 *
 * - `initialItems` vienen del SSR (query server) — ya están renderizados
 *   upstream. El hook sólo agrega los que llegan por WS después del mount.
 * - Cada `comment.id` se dedupe contra un `Set` de IDs vistos; los
 *   duplicados (ej: emisor recibe su propio broadcast sumado al
 *   `revalidatePath` que dispara SSR re-stream) se descartan.
 * - Cuando `initialItems` se actualiza (por SSR revalidate), el hook
 *   sincroniza: los IDs nuevos se agregan al Set **y** se purgan de
 *   `appendedComments` — de lo contrario se renderizarían dos veces.
 *
 * Si el subscriber falla al conectar (network, WS bloqueado), el hook
 * opera en silent-degrade: no appendea nada, SSR sigue siendo la fuente.
 */
export function useCommentRealtime(params: { postId: string; initialItems: CommentView[] }): {
  appendedComments: CommentView[]
} {
  const { postId, initialItems } = params
  const seenIds = useRef<Set<string>>(new Set(initialItems.map((c) => c.id)))
  const [appendedComments, setAppendedComments] = useState<CommentView[]>([])

  // Sync con SSR re-stream: cuando `initialItems` cambia (revalidatePath tras
  // un create), los IDs que ahora vienen por SSR se marcan como vistos **y** se
  // purgan del state local — de lo contrario se renderizarían dos veces (una
  // en SSR y otra desde appendedComments del broadcast).
  useEffect(() => {
    const initialIds = new Set(initialItems.map((c) => c.id))
    for (const id of initialIds) seenIds.current.add(id)
    setAppendedComments((prev) => {
      const filtered = prev.filter((c) => !initialIds.has(c.id))
      return filtered.length === prev.length ? prev : filtered
    })
  }, [initialItems])

  // Suscripción al canal del post.
  useEffect(() => {
    const subscriber = getSubscriber()
    const unsubscribe = subscriber.subscribe<{ comment: CommentView }>(
      `post:${postId}`,
      'comment_created',
      (payload) => {
        const comment = rehydrateDates(payload.comment)
        if (seenIds.current.has(comment.id)) return
        seenIds.current.add(comment.id)
        setAppendedComments((prev) => [...prev, comment])
      },
    )
    return unsubscribe
  }, [postId])

  return { appendedComments }
}

/**
 * El broadcast viaja las `Date` como ISO strings (JSON.stringify). Las
 * rehidratamos para que los consumidores (TimeAgo, Intl.DateTimeFormat)
 * reciban instancias `Date` como esperan — simetría con `LoadMoreComments`.
 */
function rehydrateDates(comment: CommentView): CommentView {
  return {
    ...comment,
    createdAt: new Date(comment.createdAt),
    editedAt: comment.editedAt ? new Date(comment.editedAt) : null,
    deletedAt: comment.deletedAt ? new Date(comment.deletedAt) : null,
    quotedSnapshot: comment.quotedSnapshot
      ? { ...comment.quotedSnapshot, createdAt: new Date(comment.quotedSnapshot.createdAt) }
      : null,
  }
}

// ---------------------------------------------------------------
// Subscriber factory con test seam
// ---------------------------------------------------------------

let _testSubscriber: BroadcastSubscriber | null = null

function getSubscriber(): BroadcastSubscriber {
  if (_testSubscriber) return _testSubscriber
  return new SupabaseBroadcastSubscriber(createSupabaseBrowser())
}

/**
 * Test-only. Los tests inyectan un `FakeBroadcastSubscriber` para observar
 * la interacción del hook sin abrir sockets reales. Los identificadores
 * `__prefix` + `ForTests` comunican al resto del codebase que NO usar en
 * código de producto.
 */
export function __setCommentRealtimeSubscriberForTests(sub: BroadcastSubscriber): void {
  _testSubscriber = sub
}

export function __resetCommentRealtimeSubscriberForTests(): void {
  _testSubscriber = null
}
