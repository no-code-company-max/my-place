import Link from 'next/link'
import { notFound } from 'next/navigation'
import { loadPlaceBySlug } from '@/shared/lib/place-loader'
import { resolveViewerForPlace } from '@/features/discussions/public.server'
import { EventList } from '@/features/events/public'
import { listEvents } from '@/features/events/public.server'
import { PageIcon } from '@/shared/ui/page-icon'

type Props = { params: Promise<{ placeSlug: string }> }

/**
 * Lista de eventos del place. Próximos arriba, pasados collapsed.
 *
 * Linkea a `/events/new` para proponer. F1 sin paginación; futuro cursor
 * cuando supere ~100 eventos.
 *
 * Ver `docs/features/events/spec.md § 8`.
 */
export default async function EventsPage({ params }: Props) {
  const { placeSlug } = await params
  const place = await loadPlaceBySlug(placeSlug)
  if (!place) notFound()

  const viewer = await resolveViewerForPlace({ placeSlug })
  const events = await listEvents({
    placeId: place.id,
    viewerUserId: viewer.actorId,
  })

  return (
    <div className="space-y-6 px-3 py-6">
      <header className="flex items-center gap-3">
        <PageIcon emoji="🎉" />
        <h1 className="flex-1 font-title text-[26px] font-bold tracking-[-0.6px] text-text">
          Eventos
        </h1>
        <Link
          href="/events/new"
          className="shrink-0 rounded-md bg-accent px-3 py-2 text-sm text-bg hover:opacity-90"
        >
          Proponer evento
        </Link>
      </header>
      <p className="text-sm text-muted">
        Momentos compartidos del place. Sin urgencia, sin tickets.
      </p>

      <EventList events={events} />
    </div>
  )
}
