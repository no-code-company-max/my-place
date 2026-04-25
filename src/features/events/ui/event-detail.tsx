import Link from 'next/link'
import type { EventDetailView } from '../domain/types'
import { EventCancelledBadge } from './event-cancelled-badge'
import { formatEventDateTime, formatTimezoneLabel } from './format-event-time'
import { RSVPButton } from './rsvp-button'
import { RsvpList } from './rsvp-list'
import { CancelEventButton } from './cancel-event-button'
import { RichTextRenderer } from '@/features/discussions/public'
import { FlagButton } from '@/features/flags/public'

/**
 * Página detalle de un evento. Server Component que arma el header
 * (título + fecha en TZ del evento + location + cancelado badge), la
 * descripción TipTap si existe, los RSVPs públicos + el botón de respuesta
 * del viewer + acciones de admin/author (editar, cancelar) + link al thread
 * asociado si existe.
 *
 * Ver `docs/features/events/spec.md § 11`.
 */
export function EventDetail({
  event,
  placeSlug,
  viewerUserId,
  viewerIsAdmin,
}: {
  event: EventDetailView
  placeSlug: string
  viewerUserId: string
  viewerIsAdmin: boolean
}): React.ReactNode {
  const isAuthor = event.authorUserId !== null && event.authorUserId === viewerUserId
  const isCancelled = event.state === 'cancelled'
  const isHappening = event.state === 'happening'

  return (
    <article className="space-y-6">
      <header className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h1 className="font-serif text-3xl text-place-text">{event.title}</h1>
          <div className="flex items-center gap-1">
            {!isAuthor ? <FlagButton targetType="EVENT" targetId={event.id} /> : null}
          </div>
        </div>
        {isCancelled ? (
          <p>
            <EventCancelledBadge />
          </p>
        ) : null}
        {isHappening ? (
          <p className="inline-block rounded bg-place-mark-bg px-2 py-0.5 text-xs text-place-mark-fg">
            Pasando ahora
          </p>
        ) : null}
        <div className="space-y-0.5 text-sm text-place-text-soft">
          <p>{formatEventDateTime(event.startsAt, event.endsAt, event.timezone)}</p>
          <p className="text-xs">Hora del evento — {formatTimezoneLabel(event.timezone)}</p>
          {event.location ? <p>{event.location}</p> : null}
        </div>
        <p className="text-xs text-place-text-soft">
          Propuesto por {event.authorSnapshot.displayName}
        </p>
      </header>

      {event.description ? (
        <div className="leading-relaxed text-place-text">
          <RichTextRenderer doc={event.description as never} placeSlug={placeSlug} />
        </div>
      ) : null}

      <RsvpList publicAttendees={event.publicAttendees} attendingCount={event.attendingCount} />

      <RSVPButton
        eventId={event.id}
        initialState={event.viewerOwnRsvp?.state ?? null}
        initialNote={event.viewerOwnRsvp?.note ?? null}
        cancelled={isCancelled}
      />

      {event.postId ? (
        <p className="text-sm">
          <Link
            href={`/conversations/${event.postId}`}
            className="text-place-text underline hover:text-place-mark-fg"
          >
            Ver la conversación del evento →
          </Link>
        </p>
      ) : null}

      {isAuthor || viewerIsAdmin ? (
        <footer className="flex items-center gap-3 border-t border-place-divider pt-4 text-sm">
          <Link
            href={`/events/${event.id}/edit`}
            className="rounded-md border border-place-divider px-3 py-1.5 text-place-text hover:border-place-mark-fg"
          >
            Editar
          </Link>
          {!isCancelled ? <CancelEventButton eventId={event.id} /> : null}
        </footer>
      ) : null}
    </article>
  )
}
