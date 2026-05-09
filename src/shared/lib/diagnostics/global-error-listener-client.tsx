'use client'

import { useEffect } from 'react'

/**
 * DEBUG TEMPORAL — listener global que captura cualquier throw client puro
 * (uncaught Error, unhandled Promise rejection) que NO esté siendo capturado
 * por un error.tsx local. Útil cuando el síntoma es "la página rompe pero
 * el error.tsx no muestra nada útil".
 *
 * Loguea con prefijo `[global-error]` o `[global-rejection]` para que sea
 * fácil de grepear en console del browser. No filtra ni dedupea — queremos
 * ver TODO mientras estamos diagnosticando.
 *
 * Remover una vez identificada la causa raíz del bug.
 */
export function GlobalErrorListener() {
  useEffect(() => {
    function onError(event: ErrorEvent) {
      console.error('[global-error]', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error,
        timestamp: new Date().toISOString(),
        url: window.location.href,
      })
    }
    function onRejection(event: PromiseRejectionEvent) {
      console.error('[global-rejection]', {
        reason: event.reason,
        timestamp: new Date().toISOString(),
        url: window.location.href,
      })
    }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)

    console.log('[global-error-listener] mounted')
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  return null
}
