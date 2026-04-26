'use client'

/**
 * Boundary local a la cola de reportes. Un error acá (query fallida, action
 * rota) muestra un copy calmo sin tumbar el resto de `/settings/*`.
 */
export default function SettingsFlagsError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="space-y-4 p-4 md:p-8">
      <h1 className="font-serif text-2xl italic text-text">No pudimos cargar los reportes</h1>
      <p className="text-sm text-muted">
        Algo salió mal al traer la cola de moderación. Reintentá en un momento.
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
