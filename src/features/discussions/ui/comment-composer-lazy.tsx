'use client'

import { Suspense, lazy, useEffect, useRef, useState } from 'react'

/**
 * `React.lazy` (no `next/dynamic`) — la diferencia clave es que `next/dynamic`
 * agrega el chunk dynamic-imported al `react-loadable-manifest.json`, que Next
 * usa para emitir `<link rel="preload">` en el HTML inicial. Resultado: el
 * browser descarga Lexical (~126 kB gzip) durante FCP aunque sea "lazy".
 * `React.lazy` no toca el manifest — el chunk sólo viaja cuando el componente
 * se intenta renderizar (`active === true` post-tap).
 */
const CommentComposerForm = lazy(() =>
  import('./comment-composer-form').then((m) => ({ default: m.CommentComposerForm })),
)

type Props = {
  placeId: string
  postId: string
}

/**
 * Patrón Reddit mobile. Idle: button con look de input ("Sumate a la
 * conversación"). Al tap, dispara `React.lazy` para cargar el composer
 * Lexical real (~126 kB gzip) y le pasa el foco al contenteditable interno.
 *
 * En el primer paint del thread NO hay preload del editor — el bundle
 * Lexical sólo viaja al cliente cuando el viewer activa el composer.
 * Mismo patrón que Reddit, Hacker News mobile, etc.
 *
 * Trade-off UX: el primer comment de la sesión tiene un breve loading
 * (~150ms a 4G) entre tap y editor visible. Aceptable a cambio de un
 * thread page mucho más liviano (cozytech: nada parpadea, nada grita).
 */
export function CommentComposerLazy({ placeId, postId }: Props): React.JSX.Element {
  const [active, setActive] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!active) return
    // Doble RAF: tras el primer frame `Suspense` aún muestra el fallback.
    // El segundo garantiza que `<CommentComposerForm>` ya montó y el
    // contenteditable de Lexical existe en el DOM.
    let cancelled = false
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (cancelled) return
        const editable = containerRef.current?.querySelector<HTMLElement>(
          '[contenteditable="true"]',
        )
        editable?.focus()
      })
    })
    return () => {
      cancelled = true
    }
  }, [active])

  if (!active) {
    return (
      <button
        type="button"
        onClick={() => setActive(true)}
        className="text-muted-foreground hover:bg-card/80 bg-card w-full rounded-md border border-border px-4 py-3 text-left text-sm"
      >
        Sumate a la conversación
      </button>
    )
  }

  return (
    <div ref={containerRef}>
      <Suspense fallback={<ComposerLoading />}>
        <CommentComposerForm placeId={placeId} postId={postId} />
      </Suspense>
    </div>
  )
}

function ComposerLoading(): React.JSX.Element {
  return (
    <div
      className="text-muted-foreground bg-card rounded-md border border-border px-4 py-3 text-sm"
      aria-hidden="true"
    >
      Cargando editor…
    </div>
  )
}
