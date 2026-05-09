'use client'

import { useEffect } from 'react'

/**
 * Boundary local al bucket de conversaciones. Un error acá (ej: P2002 escapado,
 * action rota) muestra un copy calmo sin tumbar la navegación del place — los
 * otros route groups (`/settings`, `/m`) siguen funcionando.
 *
 * **Logging DEBUG TEMPORAL al browser console**: en Next 15 prod, cuando un
 * Server Component throwea bajo Suspense, el `error.message` que llega al
 * cliente está **enmascarado** por seguridad ("An error occurred in the Server
 * Components render. The specific message is omitted..."). El único hilo
 * útil cliente-side es `error.digest`, que correlaciona 1:1 con un log del
 * stack completo en Vercel runtime logs. Por eso este log dispara `console.group`
 * con el digest bien visible + contexto de la URL/UA/timestamp para reportar.
 */
export default function ConversationsError({
  error,
  reset,
}: {
  error: Error & { digest?: string; cause?: unknown }
  reset: () => void
}) {
  useEffect(() => {
    const url = typeof window !== 'undefined' ? window.location.href : '(no window)'
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '(no navigator)'

    console.group(
      `%c[conversations:error] digest=${error.digest ?? '(none)'}`,
      'color:#c00;font-weight:bold',
    )

    console.error('error object:', error)

    console.error('properties:', {
      name: error.name,
      message: error.message,
      digest: error.digest,
      cause: error.cause,
      stack: error.stack,
    })

    console.error('context:', {
      url,
      timestamp: new Date().toISOString(),
      userAgent: ua,
    })

    console.error('all enumerable props:', Object.fromEntries(Object.entries(error)))

    console.groupEnd()
  }, [error])

  return (
    <div className="space-y-4 p-4 md:p-8">
      <h1 className="font-serif text-2xl italic text-text">Algo no salió bien</h1>
      <p className="text-sm text-muted">
        No pudimos cargar las conversaciones ahora. Volvé a intentarlo en un momento.
      </p>
      {error.digest ? (
        <p className="font-mono text-xs text-muted opacity-60">digest: {error.digest}</p>
      ) : null}
      {error.message ? (
        <p className="font-mono text-xs text-muted opacity-60">message: {error.message}</p>
      ) : null}
      <button
        type="button"
        onClick={reset}
        className="rounded-md border border-border bg-surface px-4 py-2 text-sm text-muted hover:text-text"
      >
        Reintentar
      </button>
    </div>
  )
}
