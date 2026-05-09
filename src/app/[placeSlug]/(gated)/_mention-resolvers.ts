import 'server-only'
import { findMemberProfile } from '@/features/members/public.server'
import { findEventForMention } from '@/features/events/public.server'
import { findLibraryItemForMention } from '@/features/library/public.server'
import { backQuery, parseBackHref } from '@/shared/lib/back-origin'
import type { MentionResolvers } from '@/features/rich-text/public.server'

type BuildMentionResolversInput = {
  placeId: string
  /**
   * Path canónico del thread/item donde se renderiza el body que contiene
   * las mentions. El resolver lo inyecta como `?back=<URL>` en el href de
   * cada mention cross-thread, así el BackButton del target vuelve al
   * thread origen específico (no a la zona). Ejemplo:
   *  - body del thread `/conversations/foo` → mention a evento → href
   *    `/conversations/<eventSlug>?back=/conversations/foo`.
   *  - body del library item `/library/cat/x` → mention a otro library
   *    item → href `/library/cat/y?back=/library/cat/x`.
   *
   * Si se omite o no es un path same-origin válido (`parseBackHref`
   * rechaza), el resolver cae al legacy `?from=conversations` para
   * preservar el comportamiento previo (back va a la zona).
   *
   * Ver `docs/decisions/2026-05-09-back-navigation-origin.md`.
   */
  currentBackHref?: string
}

/**
 * Construye los resolvers que el `RichTextRenderer` SSR usa para resolver
 * mentions a su href canónico. Compartido entre `<PostDetail>` (body del
 * post) y `<CommentsSection>` (bodies de comments).
 *
 * Lookup defensivo por slice: si el target fue archivado/cancelado/
 * eliminado el resolver retorna `null` y el renderer pinta el placeholder
 * `[EVENTO NO DISPONIBLE]` / `[RECURSO NO DISPONIBLE]`.
 */
export function buildMentionResolvers({
  placeId,
  currentBackHref,
}: BuildMentionResolversInput): MentionResolvers {
  // Sanitizamos el currentBackHref con `parseBackHref`. Si es válido,
  // armamos `?back=<encoded>` y lo usamos para mentions cross-thread.
  // Si es inválido (o ausente), caemos al legacy `?from=conversations`.
  const validBack = parseBackHref(currentBackHref)
  const crossThreadQuery = validBack !== null ? backQuery(validBack) : '?from=conversations'

  return {
    user: async (userId) => {
      const profile = await findMemberProfile(placeId, userId)
      if (!profile) return null
      return {
        label: profile.user.displayName,
        href: `/m/${userId}`,
      }
    },
    event: async (eventId) => {
      const event = await findEventForMention(eventId, placeId)
      if (!event) return null
      // F.F: el evento ES el thread — vive bajo `/conversations/<postSlug>`.
      return {
        label: event.title,
        href: `/conversations/${event.postSlug}${crossThreadQuery}`,
      }
    },
    libraryItem: async (itemId) => {
      const item = await findLibraryItemForMention(itemId, placeId)
      if (!item) return null
      return {
        label: item.title,
        href: `/library/${item.categorySlug}/${item.postSlug}${crossThreadQuery}`,
      }
    },
  }
}
