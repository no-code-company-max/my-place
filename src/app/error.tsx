'use client'

import { useEffect } from 'react'

/**
 * Root error boundary. Ver React docs: https://nextjs.org/docs/app/api-reference/file-conventions/error
 */
export default function RootError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    // TODO: hook Sentry (Fase posterior). El contrato ya está listo.
    console.error(error)
  }, [error])

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="max-w-md text-center">
        <h1 className="mb-4 font-serif text-3xl italic">Algo se rompió.</h1>
        <p className="mb-6 text-place-text-soft">Probá de nuevo. Si sigue pasando, avisanos.</p>
        <button
          type="button"
          onClick={reset}
          className="rounded-md bg-place-mark-bg px-4 py-2 text-place-mark-fg"
        >
          Reintentar
        </button>
      </div>
    </main>
  )
}
