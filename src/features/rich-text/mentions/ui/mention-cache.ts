import { $createMentionNode } from './mention-node'
import { GenericMenuOption } from './menu-option'
import type {
  ComposerMentionResolvers,
  MentionEventResult,
  MentionLibraryCategoryResult,
  MentionUserResult,
  MenuPayload,
  Trigger,
} from './mention-types'

/**
 * Helpers de cache + fetch + builders para opciones de mention.
 * Pure functions — sin runtime React.
 *
 * Extraído de `mention-plugin.tsx` durante el split por LOC.
 * Ver `docs/plans/2026-05-09-split-mention-plugin.md`.
 */

export type Caches = {
  users: MentionUserResult[] | null
  events: MentionEventResult[] | null
  categories: MentionLibraryCategoryResult[] | null
}

/**
 * Devuelve opciones desde el cache local cuando es seguro (cache hit
 * inmediato, sin round-trip). Casos cubiertos:
 *  - `@`, `/event`, `/library` con query vacía → lista cacheada al mount.
 *  - `@<q>`, `/event <q>` → filter case-insensitive sobre el cache (top-N).
 *
 * `library-item` siempre fetch live: items dependen de la categoría
 * seleccionada, no se prefetchean para no inflar el payload de mount.
 *
 * Retorna `null` si el cache no está poblado o no aplica — el caller
 * cae al fetch live como fallback.
 */
export function trySyncFromCache(trigger: Trigger, caches: Caches): GenericMenuOption[] | null {
  if (trigger.kind === 'user' && caches.users !== null) {
    const filtered = filterByQuery(caches.users, trigger.query, (u) => u.displayName)
    return filtered.map(
      (u) => new GenericMenuOption({ id: u.userId, type: 'user', user: u } satisfies MenuPayload),
    )
  }
  if (trigger.kind === 'event' && caches.events !== null) {
    const filtered = filterByQuery(caches.events, trigger.query, (e) => e.title)
    return filtered.map(
      (e) =>
        new GenericMenuOption({ id: e.eventId, type: 'event', event: e } satisfies MenuPayload),
    )
  }
  if (trigger.kind === 'library-category' && caches.categories !== null) {
    return caches.categories.map(
      (c) =>
        new GenericMenuOption({
          id: c.categoryId,
          type: 'library-category',
          category: c,
        } satisfies MenuPayload),
    )
  }
  return null
}

export function filterByQuery<T>(
  items: ReadonlyArray<T>,
  query: string,
  label: (t: T) => string,
): T[] {
  const q = query.trim().toLowerCase()
  if (q.length === 0) return [...items]
  return items.filter((i) => label(i).toLowerCase().includes(q))
}

export async function fetchOptionsForTrigger(
  trigger: Trigger,
  resolvers: ComposerMentionResolvers,
): Promise<GenericMenuOption[]> {
  if (trigger.kind === 'user') {
    const users = await resolvers.searchUsers(trigger.query)
    return users.map(
      (u) => new GenericMenuOption({ id: u.userId, type: 'user', user: u } satisfies MenuPayload),
    )
  }
  if (trigger.kind === 'event' && resolvers.searchEvents) {
    const events = await resolvers.searchEvents(trigger.query)
    return events.map(
      (e) =>
        new GenericMenuOption({ id: e.eventId, type: 'event', event: e } satisfies MenuPayload),
    )
  }
  if (trigger.kind === 'library-category' && resolvers.listCategories) {
    const cats = await resolvers.listCategories()
    return cats.map(
      (c) =>
        new GenericMenuOption({
          id: c.categoryId,
          type: 'library-category',
          category: c,
        } satisfies MenuPayload),
    )
  }
  if (trigger.kind === 'library-item' && resolvers.searchLibraryItems) {
    const items = await resolvers.searchLibraryItems(trigger.categorySlug, trigger.query)
    return items.map(
      (i) =>
        new GenericMenuOption({
          id: i.itemId,
          type: 'library-item',
          item: i,
          categorySlug: trigger.categorySlug,
        } satisfies MenuPayload),
    )
  }
  return []
}

export function buildMentionFromPayload(payload: MenuPayload, placeId: string) {
  if (payload.type === 'user') {
    return $createMentionNode({
      kind: 'user',
      targetId: payload.user.userId,
      targetSlug: payload.user.handle ?? payload.user.userId,
      label: payload.user.displayName,
      placeId,
    })
  }
  if (payload.type === 'event') {
    return $createMentionNode({
      kind: 'event',
      targetId: payload.event.eventId,
      targetSlug: payload.event.slug,
      label: payload.event.title,
      placeId,
    })
  }
  if (payload.type === 'library-category') {
    // Category mentions: re-link al landing de la categoría usando
    // `kind: library-item` con `targetId === categoryId` y label = nombre.
    // El renderer no distingue (categoría se muestra como recurso); F.5+
    // puede agregar un kind dedicado si UX lo pide.
    return $createMentionNode({
      kind: 'library-item',
      targetId: payload.category.categoryId,
      targetSlug: payload.category.slug,
      label: payload.category.name,
      placeId,
    })
  }
  return $createMentionNode({
    kind: 'library-item',
    targetId: payload.item.itemId,
    targetSlug: `${payload.categorySlug}/${payload.item.slug}`,
    label: payload.item.title,
    placeId,
  })
}
