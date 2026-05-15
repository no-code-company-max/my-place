'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { EDIT_WINDOW_MS } from '../domain/invariants'
import { EditWindowConfirmDelete } from './edit-window-confirm-delete'
import type { EditWindowSubject } from './edit-window-types'

/**
 * Acciones editar/eliminar para el autor dentro de los 60s. Tras expirar
 * la ventana, el componente deja de renderizar.
 *
 * "Editar" (F.4) solo aparece para subjects `post` y cuando el viewer NO
 * es admin: el admin ya tiene "Editar" en el kebab del header
 * (`<PostAdminMenu>`) sin límite de ventana — evitamos el botón
 * duplicado. Navega a la page dedicada `/conversations/<slug>/edit`.
 * Comments mantienen solo "Eliminar" (su edición es flujo aparte).
 */

export type { EditWindowSubject, PostSubject, CommentSubject } from './edit-window-types'

type Props = { subject: EditWindowSubject; viewerIsAdmin?: boolean }

export function EditWindowActions({ subject, viewerIsAdmin = false }: Props): React.ReactNode {
  const [remaining, setRemaining] = useState(() => remainingMs(subject.createdAt, new Date()))
  const [mode, setMode] = useState<'idle' | 'confirm-delete'>('idle')

  useEffect(() => {
    if (remaining <= 0) return
    const id = setInterval(() => {
      setRemaining(remainingMs(subject.createdAt, new Date()))
    }, 2_000)
    return () => clearInterval(id)
  }, [subject.createdAt, remaining])

  if (mode === 'confirm-delete') {
    return <EditWindowConfirmDelete subject={subject} onCancel={() => setMode('idle')} />
  }

  if (remaining <= 0) return null

  const seconds = Math.ceil(remaining / 1000)
  const showEdit = subject.kind === 'post' && !viewerIsAdmin
  return (
    <div className="mt-2 flex items-center gap-3 text-xs text-muted">
      {showEdit ? (
        <Link
          href={`/conversations/${subject.slug}/edit`}
          className="text-muted hover:text-text focus:outline-none focus-visible:underline"
        >
          Editar
        </Link>
      ) : null}
      <button
        type="button"
        onClick={() => setMode('confirm-delete')}
        className="text-muted hover:text-text focus:outline-none focus-visible:underline"
      >
        Eliminar
      </button>
      <span aria-live="polite">{seconds}s restantes</span>
    </div>
  )
}

function remainingMs(createdAt: Date, now: Date): number {
  return Math.max(0, EDIT_WINDOW_MS - (now.getTime() - createdAt.getTime()))
}
