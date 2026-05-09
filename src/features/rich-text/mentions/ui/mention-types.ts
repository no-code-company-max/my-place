/**
 * Tipos compartidos del sub-slice mentions. Sin runtime — sólo declaraciones.
 *
 * Extraído de `mention-plugin.tsx` durante el split por LOC (cap 300).
 * Ver `docs/plans/2026-05-09-split-mention-plugin.md`.
 */

// ---------------------------------------------------------------
// Resolver shapes
// ---------------------------------------------------------------

export type MentionUserResult = {
  userId: string
  displayName: string
  handle?: string | null
}

export type MentionEventResult = {
  eventId: string
  slug: string
  title: string
}

export type MentionLibraryCategoryResult = {
  categoryId: string
  slug: string
  name: string
}

export type MentionLibraryItemResult = {
  itemId: string
  slug: string
  title: string
}

/**
 * Forma legacy (F.3): un único resolver para users. El plugin lo acepta para
 * no romper consumers que ya están en producción (CommentComposer y la
 * superficie comment).
 */
export type MentionResolversForEditor = {
  placeId: string
  searchUsers: (q: string) => Promise<MentionUserResult[]>
}

/**
 * Forma extendida (F.4): 4 resolvers + `placeId`. Cubre `@user`,
 * `/event ` y `/library/<cat>[/<q>]`. La forma legacy es un subset.
 */
export type ComposerMentionResolvers = {
  placeId: string
  searchUsers: (q: string) => Promise<MentionUserResult[]>
  searchEvents?: (q: string) => Promise<MentionEventResult[]>
  listCategories?: () => Promise<MentionLibraryCategoryResult[]>
  searchLibraryItems?: (categorySlug: string, q: string) => Promise<MentionLibraryItemResult[]>
}

// ---------------------------------------------------------------
// Trigger union — kinds que el plugin escucha
// ---------------------------------------------------------------

export type Trigger =
  | { kind: 'user'; query: string }
  | { kind: 'event'; query: string }
  | { kind: 'library-category'; query: string }
  | { kind: 'library-item'; categorySlug: string; query: string }

// ---------------------------------------------------------------
// MenuPayload — discriminada por kind del item rendereado en el menu
// ---------------------------------------------------------------

export type MenuPayload =
  | { id: string; type: 'user'; user: MentionUserResult }
  | { id: string; type: 'event'; event: MentionEventResult }
  | {
      id: string
      type: 'library-category'
      category: MentionLibraryCategoryResult
    }
  | {
      id: string
      type: 'library-item'
      item: MentionLibraryItemResult
      categorySlug: string
    }
