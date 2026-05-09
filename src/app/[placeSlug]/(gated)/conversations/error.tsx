'use client'

import { useEffect } from 'react'

/**
 * Boundary local al bucket de conversaciones. Un error acá (ej: P2002 escapado,
 * action rota) muestra un copy calmo sin tumbar la navegación del place — los
 * otros route groups (`/settings`, `/m`) siguen funcionando.
 *
 * **Logging al browser console (DEBUG temp)**: en Next 15, cuando el error.tsx
 * local captura un throw server-side, el throw NO se loggea al stderr server
 * (Next lo considera "manejado"). Para diagnóstico, replicamos el error.message
 * + digest al console del cliente — desde ahí se puede correlacionar con la
 * request real. Si el message viene oculto en prod por minificación, el `digest`
 * es la pista para buscar en server logs (Vercel asigna digest único por throw).
 */
export default function ConversationsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[conversations:error]', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
      name: error.name,
    })
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
