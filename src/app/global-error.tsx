'use client'

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="es">
      <body>
        <main className="flex min-h-screen items-center justify-center p-8">
          <div className="max-w-md text-center">
            <h1 className="mb-4 font-serif text-3xl italic">Algo se rompió.</h1>
            <p className="mb-6">Probá de nuevo. Si sigue pasando, avisanos.</p>
            <button type="button" onClick={reset}>
              Reintentar
            </button>
            <pre className="mt-4 text-xs opacity-50">{error.message}</pre>
          </div>
        </main>
      </body>
    </html>
  )
}
