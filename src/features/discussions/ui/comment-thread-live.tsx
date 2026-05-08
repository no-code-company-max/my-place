'use client'

import { Suspense, lazy, useEffect, useState, type ReactNode } from 'react'
import type { CommentView } from '../server/queries'

/**
 * `React.lazy` (no `next/dynamic`) — Next 15 emite preload automático
 * para chunks de `next/dynamic`. `React.lazy` sólo carga el chunk
 * cuando el componente se renderiza por primera vez. Ver gotcha en
 * CLAUDE.md sobre `next/dynamic` vs `React.lazy`.
 */
const CommentRealtimeAppender = lazy(() =>
  import('./comment-realtime-appender').then((m) => ({ default: m.CommentRealtimeAppender })),
)

/**
 * Wrapper client-side del thread: renderiza los items SSR como `children`
 * y appendea comments nuevos recibidos por `comment_created` broadcast
 * (ver `use-comment-realtime.ts` + `server/realtime.ts`).
 *
 * **Lazy realtime**: el sub-componente que ejecuta el hook Supabase vive
 * en `comment-realtime-appender.tsx` y se carga via `React.lazy` después
 * del primer paint (gateado por `requestIdleCallback`). El bundle de
 * Supabase Realtime + GoTrue (~12-15 kB gzip) NO viaja en First Load.
 *
 * UX: los comments SSR aparecen inmediato; los nuevos comments por
 * realtime aparecen unos ms después en silencio (cozytech: nada
 * parpadea, nada grita). Si el user lee comments durante esos primeros
 * ~150ms, no pierde nada — el realtime es para comments POSTERIORES.
 *
 * Render de SSR (`children`) NO se re-renderiza en el cliente: el wrapper
 * solo coloca los nuevos debajo. Esto preserva reacciones ya agregadas +
 * estado de citas congelado.
 */
export function CommentThreadLive({
  postId,
  initialItems,
  children,
}: {
  postId: string
  /** Mantenidos en la firma por compat con el call site; usados por el sub-componente. */
  placeSlug: string
  viewerUserId: string
  viewerIsAdmin: boolean
  initialItems: CommentView[]
  children: ReactNode
}): React.ReactNode {
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    const win = window as Window & {
      requestIdleCallback?: (cb: IdleRequestCallback, opts?: { timeout: number }) => number
      cancelIdleCallback?: (handle: number) => void
    }
    if (typeof win.requestIdleCallback === 'function') {
      const handle = win.requestIdleCallback(() => setArmed(true), { timeout: 2000 })
      return () => {
        win.cancelIdleCallback?.(handle)
      }
    }
    const timer = setTimeout(() => setArmed(true), 100)
    return () => {
      clearTimeout(timer)
    }
  }, [])

  return (
    <>
      {children}
      {armed ? (
        <Suspense fallback={null}>
          <CommentRealtimeAppender postId={postId} initialItems={initialItems} />
        </Suspense>
      ) : null}
    </>
  )
}
