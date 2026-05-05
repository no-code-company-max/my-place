'use client'

import { useTransition } from 'react'
import {
  markItemCompletedAction,
  unmarkItemCompletedAction,
} from '@/features/library/courses/public'
import { toast } from '@/shared/ui/toaster'

/**
 * Botón Mark Complete / Marcado para items en categorías `kind === 'COURSE'`
 * — solo se renderiza desde la page detalle del item.
 *
 * Estados:
 *  - `completed = false` → "Marcar como completado".
 *  - `completed = true`  → "Completado · Desmarcar".
 *
 * Toggle optimista UI sería ideal pero requiere router refresh igual.
 * Por simplicidad: useTransition + revalidatePath del action — al
 * volver del server, RSC re-renderiza con el flag actualizado.
 *
 * Decisión #D3 ADR `2026-05-04-library-courses-and-read-access.md`:
 *  - Marcar es manual (no auto-on-open).
 *  - Idempotente — la action ignora P2002 / count=0.
 *  - Privado por user (no se ve en métricas públicas).
 */
type Props = {
  itemId: string
  completed: boolean
}

export function MarkCompleteButton({ itemId, completed }: Props): React.ReactNode {
  const [pending, startTransition] = useTransition()

  function handleClick(): void {
    startTransition(async () => {
      try {
        if (completed) {
          await unmarkItemCompletedAction({ itemId })
          toast.success('Marca removida.')
        } else {
          const result = await markItemCompletedAction({ itemId })
          toast.success(result.alreadyCompleted ? 'Ya estaba marcado.' : 'Marcado como completado.')
        }
      } catch {
        toast.error('No pudimos actualizar la marca. Reintentá en un momento.')
      }
    })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-pressed={completed}
      className={[
        'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors',
        completed
          ? 'border-[0.5px] border-border bg-soft text-text hover:bg-bg'
          : 'bg-text text-bg hover:opacity-90',
        pending ? 'cursor-not-allowed opacity-60' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {completed ? (
        <>
          <svg
            aria-hidden="true"
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12l5 5L20 7" />
          </svg>
          <span>Completado · Desmarcar</span>
        </>
      ) : (
        <span>Marcar como completado</span>
      )}
    </button>
  )
}
