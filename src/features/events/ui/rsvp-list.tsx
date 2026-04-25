import Link from 'next/link'
import type { EventDetailView } from '../domain/types'

/**
 * "Quién viene": lista de avatares + nombres de los miembros que dijeron
 * `GOING` o `GOING_CONDITIONAL`. Los `NOT_GOING` y `NOT_GOING_CONTRIBUTING`
 * se filtran de esta lista (regla ontológica: "quién no, no se presiona").
 *
 * Para `GOING_CONDITIONAL`, el `note` se muestra inline ("voy si X").
 * Para `NOT_GOING_CONTRIBUTING`, F1 NO expone el aporte públicamente —
 * decisión conservadora; spec-rsvp.md § 4 documenta el rationale.
 *
 * Server Component. Avatares enlazados al perfil contextual del miembro
 * (`/m/[userId]`).
 */
export function RsvpList({
  publicAttendees,
  attendingCount,
}: {
  publicAttendees: EventDetailView['publicAttendees']
  attendingCount: number
}): React.ReactNode {
  if (publicAttendees.length === 0) {
    return (
      <section aria-label="Quién viene" className="text-sm text-place-text-soft">
        Aún nadie confirmó. Sé el primero.
      </section>
    )
  }

  return (
    <section aria-label="Quién viene" className="space-y-2">
      <h2 className="text-sm font-medium text-place-text-soft">Quién viene ({attendingCount})</h2>
      <ul className="flex flex-wrap gap-3">
        {publicAttendees.map((attendee) => (
          <li key={attendee.userId} className="flex items-center gap-2">
            <Link
              href={`/m/${attendee.userId}`}
              className="flex items-center gap-2 rounded-full border border-place-divider bg-place-card px-2.5 py-1 text-xs hover:border-place-mark-fg"
              title={attendee.displayName}
            >
              {attendee.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={attendee.avatarUrl}
                  alt=""
                  className="h-6 w-6 rounded-full object-cover"
                  width={24}
                  height={24}
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-place-mark-bg text-[10px] uppercase text-place-mark-fg"
                >
                  {attendee.displayName.slice(0, 1)}
                </span>
              )}
              <span className="text-place-text">{attendee.displayName}</span>
              {attendee.state === 'GOING_CONDITIONAL' && attendee.note ? (
                <span className="ml-1 text-[10px] italic text-place-text-soft">
                  voy si {attendee.note}
                </span>
              ) : null}
              {attendee.state === 'GOING_CONDITIONAL' && !attendee.note ? (
                <span className="ml-1 text-[10px] italic text-place-text-soft">voy si…</span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
