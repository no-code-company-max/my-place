'use client'

/**
 * Boundary local al bucket de conversaciones. Un error acá (ej: P2002 escapado,
 * action rota) muestra un copy calmo sin tumbar la navegación del place — los
 * otros route groups (`/settings`, `/m`) siguen funcionando.
 */
export default function ConversationsError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="space-y-4 p-4 md:p-8">
      <h1 className="font-serif text-2xl italic text-text">Algo no salió bien</h1>
      <p className="text-sm text-muted">
        No pudimos cargar las conversaciones ahora. Volvé a intentarlo en un momento.
      </p>
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
