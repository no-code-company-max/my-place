'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'
import { rsvpEventAction } from '../server/actions/rsvp'
import { RSVPState as RSVPStateEnum, type RSVPState } from '@/features/events/domain/types'
import { RSVP_BUTTON_ORDER, rsvpAcceptsNote, rsvpLabel, rsvpTextfieldHints } from './rsvp-labels'
import { friendlyEventErrorMessage } from '@/features/events/ui/errors'

type Props = {
  eventId: string
  /** RSVP actual del viewer (null si nunca respondió). Estado optimistic
   *  arranca de acá; al confirmar el server, el `revalidatePath` desde la
   *  action refresca todo el detail desde server. */
  initialState: RSVPState | null
  initialNote: string | null
  /** Si el evento está cancelado, deshabilitamos el upsert (también enforced
   *  por server + RLS). UI muestra mensaje quieto en vez del botonazo. */
  cancelled: boolean
}

type Feedback = { kind: 'err'; message: string } | null

/**
 * 4 botones (uno por estado) + textfield condicional para los 2 estados
 * texturados (`GOING_CONDITIONAL`, `NOT_GOING_CONTRIBUTING`).
 *
 * Optimistic: al hacer click, actualizamos `currentState` localmente
 * inmediatamente. Si el server falla, revertimos al estado previo y
 * mostramos el error.
 *
 * F1 sin realtime: tras la action, `revalidatePath` (en server) refresca el
 * detail completo. El optimistic local sólo cubre el delay round-trip.
 */
export function RSVPButton({
  eventId,
  initialState,
  initialNote,
  cancelled,
}: Props): React.ReactNode {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [currentState, setCurrentState] = useState<RSVPState | null>(initialState)
  const [note, setNote] = useState<string>(initialNote ?? '')
  const [feedback, setFeedback] = useState<Feedback>(null)

  if (cancelled) {
    return (
      <section
        aria-label="RSVP"
        className="rounded-[10px] border-[0.5px] border-border bg-soft p-3 text-sm text-muted"
      >
        Evento cancelado — las RSVPs se preservan, no se pueden cambiar.
      </section>
    )
  }

  function submit(nextState: RSVPState): void {
    setFeedback(null)
    const previousState = currentState
    const previousNote = note
    setCurrentState(nextState)
    if (!rsvpAcceptsNote(nextState)) setNote('')

    startTransition(async () => {
      try {
        await rsvpEventAction({
          eventId,
          state: nextState,
          note: rsvpAcceptsNote(nextState) ? note : null,
        })
        router.refresh()
      } catch (err) {
        setCurrentState(previousState)
        setNote(previousNote)
        setFeedback({ kind: 'err', message: friendlyEventErrorMessage(err) })
      }
    })
  }

  function submitNoteUpdate(): void {
    if (!currentState || !rsvpAcceptsNote(currentState)) return
    setFeedback(null)
    startTransition(async () => {
      try {
        await rsvpEventAction({ eventId, state: currentState, note })
        router.refresh()
      } catch (err) {
        setFeedback({ kind: 'err', message: friendlyEventErrorMessage(err) })
      }
    })
  }

  const textfieldHints = currentState ? rsvpTextfieldHints(currentState) : null

  return (
    <section aria-label="RSVP" className="space-y-3">
      <h2 className="font-body text-xs font-semibold uppercase tracking-wider text-muted">
        ¿Venís?
      </h2>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {RSVP_BUTTON_ORDER.map((state) => {
          const active = state === currentState
          const showCheck = active && state === RSVPStateEnum.GOING
          return (
            <button
              key={state}
              type="button"
              onClick={() => submit(state)}
              disabled={pending}
              aria-pressed={active}
              className={[
                'flex h-10 items-center justify-center gap-1 rounded-[10px] font-body text-[13px] font-semibold disabled:opacity-60 motion-safe:transition-colors',
                active ? 'bg-text text-bg' : 'bg-soft text-text hover:bg-border',
              ].join(' ')}
            >
              {showCheck ? <Check size={12} aria-hidden="true" /> : null}
              {rsvpLabel(state)}
            </button>
          )
        })}
      </div>

      {textfieldHints && currentState ? (
        <div className="space-y-1">
          <label className="block text-xs text-muted" htmlFor="rsvp-note">
            {textfieldHints.label}
          </label>
          <div className="flex items-center gap-2">
            <input
              id="rsvp-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 280))}
              onBlur={() => {
                if (note !== (initialNote ?? '')) submitNoteUpdate()
              }}
              placeholder={textfieldHints.placeholder}
              maxLength={280}
              disabled={pending}
              className="flex-1 rounded-[10px] border-[0.5px] border-border bg-surface px-3 py-1.5 text-sm text-text focus:border-accent focus:outline-none"
            />
            <span className="text-[10px] text-muted">{note.length}/280</span>
          </div>
        </div>
      ) : null}

      {feedback?.kind === 'err' ? (
        <p
          role="alert"
          aria-live="polite"
          className="rounded-[10px] border-[0.5px] border-amber-300 bg-amber-50 p-2 text-xs text-amber-900"
        >
          {feedback.message}
        </p>
      ) : null}
    </section>
  )
}
