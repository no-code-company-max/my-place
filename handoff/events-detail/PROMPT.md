# Prompt — Event Detail

```
Voy a implementar la slice de Event Detail siguiendo
docs/design/events-detail/.

Stack: Next.js 15 App Router, TS strict, Tailwind + CSS vars,
Supabase + Prisma, TanStack Query, date-fns con locale es-AR.

Pasos:

1. Lee docs/design/events-detail/DESIGN_NOTES.md y components.tsx.

2. Estructura:
   - app/[community]/events/[eventId]/page.tsx (Server Component)
     · query event + host + attendees (top 8) + count + myRsvp en paralelo
   - components/event-detail/EventHeaderBar.tsx (Client) — back + share
   - components/event-detail/EventHero.tsx (Server) — image o fallback gradient
   - components/event-detail/EventMeta.tsx (Server) — date eyebrow + title + meta rows
   - components/event-detail/EventDescription.tsx (Server)
   - components/event-detail/EventHost.tsx (Server)
   - components/event-detail/EventAttendees.tsx (Server)
   - components/event-detail/RsvpBar.tsx (Client) — toggle con optimistic update

3. Mutación:
   - useRsvp(eventId, status: 'going' | 'maybe' | null)
   - Optimistic en cache de event detail Y en cache de events list.

4. Date formatting:
   - format(startsAt, "EEE d MMM · HH:mm", { locale: esAR })
   - Capitalizar primer char.

5. Share:
   - Si navigator.share existe, úsalo con title + url.
   - Sino, copy al clipboard + toast.

6. Maps deep link:
   - mapsHref = `https://maps.google.com/?q=${encodeURIComponent(location.label)}`
   - Open en _blank.

Cuando termines mostrame:
- Estructura de archivos
- Cómo manejaste el optimistic update en 2 caches
```

## Notas

- **Layout especial**: este screen no usa el shell de comunidad. `app/[community]/events/[eventId]/layout.tsx` puede ser ligero.
- **Imagen del hero**: si `imageUrl` viene vacío, mostrar el fallback. No reservar espacio si la imagen no carga (use `onError`).
- **Time zone**: parsear `startsAt` como UTC y formatear en `America/Argentina/Buenos_Aires`. El backend guarda UTC.
