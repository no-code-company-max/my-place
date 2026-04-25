import type { EventListView } from '../domain/types'
import { EventListItem } from './event-list-item'

/**
 * Lista de eventos del place. Divide en dos secciones:
 *  - **Próximos** (upcoming + happening): abierta arriba, ASC por startsAt.
 *  - **Pasados** (past): collapsed bajo `<details>`, DESC por startsAt.
 *
 * Cancelados se conservan en su sección original con badge.
 *
 * Sin scroll infinito. F1 sin paginación; cuando supere 20 events se agrega
 * cursor (mismo patrón discussions).
 */
export function EventList({ events }: { events: EventListView[] }): React.ReactNode {
  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-place-divider bg-place-card p-6 text-center text-sm text-place-text-soft">
        Todavía no hay eventos. Proponé el primero.
      </div>
    )
  }

  const upcoming = events.filter((e) => e.state === 'upcoming' || e.state === 'happening')
  const past = events.filter((e) => e.state === 'past' || e.state === 'cancelled').reverse() // El query devuelve startsAt ASC; en pasados queremos DESC.

  return (
    <div className="space-y-6">
      {upcoming.length > 0 ? (
        <section aria-label="Próximos eventos" className="space-y-3">
          {upcoming.map((event) => (
            <EventListItem key={event.id} event={event} />
          ))}
        </section>
      ) : (
        <p className="text-sm text-place-text-soft">No hay eventos próximos.</p>
      )}

      {past.length > 0 ? (
        <details className="group rounded-lg border border-place-divider bg-place-card">
          <summary className="cursor-pointer px-4 py-3 text-sm text-place-text-soft hover:text-place-text">
            <span className="font-medium">Pasados ({past.length})</span>
            <span className="ml-2 text-xs italic group-open:hidden">— mostrar</span>
            <span className="ml-2 hidden text-xs italic group-open:inline">— ocultar</span>
          </summary>
          <div className="space-y-3 border-t border-place-divider p-3">
            {past.map((event) => (
              <EventListItem key={event.id} event={event} />
            ))}
          </div>
        </details>
      ) : null}
    </div>
  )
}
