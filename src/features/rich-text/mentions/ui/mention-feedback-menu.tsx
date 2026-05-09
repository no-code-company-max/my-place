'use client'

import * as React from 'react'
import type { Trigger } from './mention-types'

/**
 * Placeholder visual mientras el `fetchOptionsForTrigger` resuelve, o
 * mensaje claro si el fetch falló (kind="error"). Aparece sólo en cache
 * miss; cache hit muestra los items directo. Texto contextual al trigger
 * para que el viewer sepa qué está pasando. Spinner / icon CSS puro
 * (sin dep externa).
 *
 * Extraído de `mention-plugin.tsx` durante el split por LOC. El export
 * dejaba de ser "sólo para tests" porque ahora vive en archivo propio
 * con un único consumer interno (mention-plugin) + el test del slice.
 */
export function MentionFeedbackMenu({
  kind,
  trigger,
  slow = false,
}: {
  kind: 'loading' | 'error'
  trigger: Trigger
  /**
   * Sólo aplica a `kind === 'loading'`. Cuando `true`, el label cambia
   * a "Sigue cargando…" para confirmar al viewer que el cliente NO
   * se colgó — la red está lenta. Default `false` mantiene el label
   * normal del primer momento del fetch.
   */
  slow?: boolean
}): React.JSX.Element {
  const target =
    trigger.kind === 'user'
      ? 'miembros'
      : trigger.kind === 'event'
        ? 'eventos'
        : trigger.kind === 'library-category'
          ? 'categorías'
          : 'recursos'
  const label =
    kind === 'error'
      ? `No pudimos cargar ${target}. Probá de nuevo.`
      : slow
        ? `Sigue cargando ${target}…`
        : trigger.kind === 'user' || trigger.kind === 'event'
          ? `Buscando ${target}…`
          : `Cargando ${target}…`
  // Cromática diferenciada por kind: el error usa border + bg + texto ámbar
  // (cozytech: tono cálido, no rojo gritón) para que se distinga del loading
  // a primera vista — sin contraste, ambos estados se confundían en un mismo
  // tono neutral. Loading mantiene el tono neutral propio del placeholder.
  const containerClass =
    kind === 'error'
      ? 'rich-text-mention-menu min-w-[260px] overflow-hidden rounded-md border border-amber-300 bg-amber-50 shadow-lg'
      : 'rich-text-mention-menu min-w-[260px] overflow-hidden rounded-md border border-neutral-200 bg-white shadow-lg'
  const innerClass =
    kind === 'error'
      ? 'flex items-center gap-2 px-3 py-2 text-sm text-amber-700'
      : 'flex items-center gap-2 px-3 py-2 text-sm text-neutral-500'
  return (
    <div data-mention-feedback={kind} className={containerClass}>
      <div role={kind === 'error' ? 'alert' : 'status'} aria-live="polite" className={innerClass}>
        {kind === 'loading' ? (
          <span
            aria-hidden
            className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600"
          />
        ) : (
          <span aria-hidden className="text-amber-600">
            ⚠
          </span>
        )}
        <span className="truncate">{label}</span>
      </div>
    </div>
  )
}
