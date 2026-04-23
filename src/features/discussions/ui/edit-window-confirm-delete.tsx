'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteCommentAction } from '../server/actions/comments'
import { deletePostAction } from '../server/actions/posts'
import { friendlyErrorMessage } from './utils'
import type { EditWindowSubject } from './edit-window-types'

type Props = {
  subject: EditWindowSubject
  onCancel: () => void
}

/**
 * Confirmación inline para borrar Post o Comment desde el UI del autor (ventana
 * 60s). Post es hard delete (C.G.1); Comment es soft delete. El flujo admin
 * para targets ajenos vive en `post-admin-menu` / `comment-admin-menu`.
 */
export function EditWindowConfirmDelete({ subject, onCancel }: Props): React.ReactNode {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    setError(null)
    startTransition(async () => {
      try {
        if (subject.kind === 'post') {
          await deletePostAction({
            postId: subject.postId,
            expectedVersion: subject.version,
          })
          router.replace(`/conversations`)
        } else {
          await deleteCommentAction({
            commentId: subject.commentId,
            expectedVersion: subject.version,
          })
        }
      } catch (err) {
        setError(friendlyErrorMessage(err))
      }
    })
  }

  return (
    <div className="mt-2 flex flex-col gap-2 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
      <span>¿Eliminar definitivamente? No se puede deshacer.</span>
      {error ? (
        <p role="alert" aria-live="polite">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={submit}
          className="rounded-md bg-amber-700 px-3 py-1 text-xs text-white disabled:opacity-60"
        >
          {pending ? 'Eliminando…' : 'Sí, eliminar'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-3 py-1 text-xs text-amber-900"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
