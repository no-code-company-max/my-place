import 'server-only'
import { unstable_cache } from 'next/cache'
import { prisma } from '@/db/client'

/**
 * Search liviano de eventos para autocomplete `/event ` en composers
 * (F.4 rich-text). Filtra por `placeId` + `title ILIKE %q%`. Excluye
 * cancelados (no tiene sentido mencionar un cancelado en otro doc;
 * el snapshot defensivo del renderer los marca igual `[NO DISPONIBLE]`
 * si después se cancelan).
 *
 * Cacheado con `unstable_cache` + tag `place-search:${placeId}:events`
 * revalidate 60s.
 */

const SEARCH_REVALIDATE_SECONDS = 60
const MAX_RESULTS = 8

const searchEventsTag = (placeId: string): string => `place-search:${placeId}:events`

export type MentionEvent = {
  eventId: string
  slug: string
  title: string
}

export async function searchEventsByPlace(placeId: string, q: string): Promise<MentionEvent[]> {
  const trimmed = q.trim()
  return unstable_cache(
    async () => searchEventsInternal(placeId, trimmed),
    ['mention-search-events', placeId, trimmed],
    {
      revalidate: SEARCH_REVALIDATE_SECONDS,
      tags: [searchEventsTag(placeId)],
    },
  )()
}

async function searchEventsInternal(placeId: string, q: string): Promise<MentionEvent[]> {
  const events = await prisma.event.findMany({
    where: {
      placeId,
      cancelledAt: null,
      ...(q.length > 0 ? { title: { contains: q, mode: 'insensitive' } } : {}),
    },
    take: MAX_RESULTS,
    orderBy: [{ startsAt: 'desc' }, { id: 'asc' }],
    select: {
      id: true,
      title: true,
      post: { select: { slug: true } },
    },
  })
  return events
    .filter((e): e is typeof e & { post: { slug: string } } => e.post !== null)
    .map((e) => ({ eventId: e.id, slug: e.post.slug, title: e.title }))
}

/**
 * Lookup defensivo de un evento mencionado en un documento rich-text. Devuelve
 * `null` si el eventId no existe en el placeId indicado, o si el evento está
 * cancelado — el renderer pinta `[EVENTO NO DISPONIBLE]` ante null.
 *
 * Sin cache: las mentions se resuelven al render del post; el volumen total
 * por page es bajo (cap por size del rich-text). Si crece, se cachea con tag
 * por `(placeId, eventId)`.
 */
export async function findEventForMention(
  eventId: string,
  placeId: string,
): Promise<{ title: string; postSlug: string } | null> {
  const event = await prisma.event.findFirst({
    where: { id: eventId, placeId, cancelledAt: null },
    select: { title: true, post: { select: { slug: true } } },
  })
  if (!event || !event.post) return null
  return { title: event.title, postSlug: event.post.slug }
}
