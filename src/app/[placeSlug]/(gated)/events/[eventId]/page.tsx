import { notFound } from 'next/navigation'
import { loadPlaceBySlug } from '@/shared/lib/place-loader'
import { resolveViewerForPlace } from '@/features/discussions/public.server'
import { EventDetail } from '@/features/events/public'
import { getEvent } from '@/features/events/public.server'

type Props = { params: Promise<{ placeSlug: string; eventId: string }> }

/**
 * Detalle del evento. Server Component que arma todo desde queries +
 * delega RSVP + cancel a Client Components.
 *
 * Si el `eventId` no existe o pertenece a otro place → 404.
 *
 * Ver `docs/features/events/spec.md § 11`.
 */
export default async function EventDetailPage({ params }: Props) {
  const { placeSlug, eventId } = await params
  const place = await loadPlaceBySlug(placeSlug)
  if (!place || place.archivedAt) notFound()

  const viewer = await resolveViewerForPlace({ placeSlug })
  const event = await getEvent({
    eventId,
    placeId: place.id,
    viewerUserId: viewer.actorId,
  })
  if (!event) notFound()

  return (
    <main className="mx-auto max-w-2xl p-4 md:p-8">
      <EventDetail
        event={event}
        placeSlug={placeSlug}
        viewerUserId={viewer.actorId}
        viewerIsAdmin={viewer.isAdmin}
      />
    </main>
  )
}
