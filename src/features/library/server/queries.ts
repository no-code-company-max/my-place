import 'server-only'
import { prisma } from '@/db/client'
import type {
  ItemAuthorSnapshot,
  LibraryCategory,
  LibraryCategoryContributor,
  LibraryItemDetailView,
  LibraryItemListView,
} from '../domain/types'

/**
 * Queries del slice `library` (R.7.2 — solo categorías).
 *
 * Solo este archivo + `server/actions/*` tocan Prisma. El resto del
 * slice (UI, domain) consume via `public.ts` / `public.server.ts`.
 *
 * RLS está activa sobre `LibraryCategory` y `LibraryCategoryContributor`
 * (migration 20260430000000) — un viewer sin membership activa nunca
 * ve filas via authenticated client. Acá usamos el `prisma` singleton
 * (service role) que bypassea RLS, así que aplicamos el filtro por
 * place explícitamente en el WHERE para mantener igualdad funcional.
 *
 * Ver `docs/features/library/spec.md` § 10.
 */

// ---------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------

type CategoryRow = {
  id: string
  slug: string
  emoji: string
  title: string
  position: number | null
  contributionPolicy: 'ADMIN_ONLY' | 'DESIGNATED' | 'MEMBERS_OPEN'
  archivedAt: Date | null
  createdAt: Date
  updatedAt: Date
  _count?: { items: number }
}

function mapCategoryRow(row: CategoryRow, docCount: number): LibraryCategory {
  return {
    id: row.id,
    slug: row.slug,
    emoji: row.emoji,
    title: row.title,
    position: row.position,
    contributionPolicy: row.contributionPolicy,
    archivedAt: row.archivedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    docCount,
  }
}

// ---------------------------------------------------------------
// Categories — list / find
// ---------------------------------------------------------------

export type ListLibraryCategoriesOptions = {
  /** Si true, incluye categorías archivadas (admin view). Default false. */
  includeArchived?: boolean
}

/**
 * Lista categorías de un place ordenadas por (position ASC NULLS LAST,
 * createdAt ASC). NULLS LAST = categorías nuevas no reordenadas
 * aparecen al final del orden visual.
 *
 * `docCount` es el número de items NO archivados de cada categoría
 * (R.7.6+). Calculado vía `_count` aggregate de Prisma.
 */
export async function listLibraryCategories(
  placeId: string,
  opts: ListLibraryCategoriesOptions = {},
): Promise<LibraryCategory[]> {
  const rows = await prisma.libraryCategory.findMany({
    where: {
      placeId,
      ...(opts.includeArchived ? {} : { archivedAt: null }),
    },
    orderBy: [{ position: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
    select: {
      id: true,
      slug: true,
      emoji: true,
      title: true,
      position: true,
      contributionPolicy: true,
      archivedAt: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: { items: { where: { archivedAt: null } } },
      },
    },
  })
  return rows.map((r) => mapCategoryRow(r, r._count.items))
}

/**
 * Resuelve una categoría por slug dentro de un place. Devuelve null si
 * no existe o está archivada (las archivadas se filtran salvo que
 * `includeArchived` se pase explícitamente — útil para admin restore).
 */
export async function findLibraryCategoryBySlug(
  placeId: string,
  slug: string,
  opts: { includeArchived?: boolean } = {},
): Promise<LibraryCategory | null> {
  const row = await prisma.libraryCategory.findUnique({
    where: { placeId_slug: { placeId, slug } },
    select: {
      id: true,
      slug: true,
      emoji: true,
      title: true,
      position: true,
      contributionPolicy: true,
      archivedAt: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: { items: { where: { archivedAt: null } } },
      },
    },
  })
  if (!row) return null
  if (!opts.includeArchived && row.archivedAt) return null
  return mapCategoryRow(row, row._count.items)
}

/**
 * Resuelve una categoría por id (admin actions, eventos system).
 * Acepta archivadas para no romper flows de "des-archivar".
 */
export async function findLibraryCategoryById(categoryId: string): Promise<LibraryCategory | null> {
  const row = await prisma.libraryCategory.findUnique({
    where: { id: categoryId },
    select: {
      id: true,
      slug: true,
      emoji: true,
      title: true,
      position: true,
      contributionPolicy: true,
      archivedAt: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: { items: { where: { archivedAt: null } } },
      },
    },
  })
  if (!row) return null
  return mapCategoryRow(row, row._count.items)
}

/**
 * Cuenta categorías no archivadas del place. Usada por
 * `assertCategoryCapacity` antes del create.
 */
export async function countLibraryCategories(placeId: string): Promise<number> {
  return prisma.libraryCategory.count({
    where: { placeId, archivedAt: null },
  })
}

// ---------------------------------------------------------------
// Contributors
// ---------------------------------------------------------------

/**
 * Lista contributors designated de una categoría con datos de User
 * para renderizar avatar + nombre sin queries N+1.
 */
export async function listCategoryContributors(
  categoryId: string,
): Promise<LibraryCategoryContributor[]> {
  const rows = await prisma.libraryCategoryContributor.findMany({
    where: { categoryId },
    orderBy: { invitedAt: 'asc' },
    select: {
      categoryId: true,
      userId: true,
      invitedAt: true,
      invitedByUserId: true,
      user: {
        select: { displayName: true, avatarUrl: true },
      },
      invitedBy: {
        select: { displayName: true },
      },
    },
  })
  return rows.map((r) => ({
    categoryId: r.categoryId,
    userId: r.userId,
    displayName: r.user.displayName,
    avatarUrl: r.user.avatarUrl,
    invitedAt: r.invitedAt,
    invitedByUserId: r.invitedByUserId,
    invitedByDisplayName: r.invitedBy.displayName,
  }))
}

/**
 * Devuelve solo los userIds de contributors — útil para
 * `canCreateInCategory` sin pagar el JOIN si solo necesitamos auth.
 */
export async function listCategoryContributorUserIds(categoryId: string): Promise<string[]> {
  const rows = await prisma.libraryCategoryContributor.findMany({
    where: { categoryId },
    select: { userId: true },
  })
  return rows.map((r) => r.userId)
}

/**
 * Batch query: contributors agrupados por `categoryId`. Usada por la
 * page admin para precargar la lista de todas las categorías
 * `DESIGNATED` sin N+1.
 *
 * Devuelve un `Map<categoryId, contributors[]>`. Categorías sin
 * contributors no aparecen en el Map (caller chequea
 * `map.get(id) ?? []`).
 */
export async function listContributorsByCategoryIds(
  categoryIds: ReadonlyArray<string>,
): Promise<Map<string, LibraryCategoryContributor[]>> {
  if (categoryIds.length === 0) return new Map()
  const rows = await prisma.libraryCategoryContributor.findMany({
    where: { categoryId: { in: [...categoryIds] } },
    orderBy: { invitedAt: 'asc' },
    select: {
      categoryId: true,
      userId: true,
      invitedAt: true,
      invitedByUserId: true,
      user: {
        select: { displayName: true, avatarUrl: true },
      },
      invitedBy: {
        select: { displayName: true },
      },
    },
  })
  const map = new Map<string, LibraryCategoryContributor[]>()
  for (const r of rows) {
    const existing = map.get(r.categoryId) ?? []
    existing.push({
      categoryId: r.categoryId,
      userId: r.userId,
      displayName: r.user.displayName,
      avatarUrl: r.user.avatarUrl,
      invitedAt: r.invitedAt,
      invitedByUserId: r.invitedByUserId,
      invitedByDisplayName: r.invitedBy.displayName,
    })
    map.set(r.categoryId, existing)
  }
  return map
}

// ---------------------------------------------------------------
// Items (R.7.6)
// ---------------------------------------------------------------

function readAuthorSnapshot(raw: unknown): ItemAuthorSnapshot {
  if (raw && typeof raw === 'object' && 'displayName' in raw) {
    const obj = raw as { displayName: unknown; avatarUrl?: unknown }
    return {
      displayName: typeof obj.displayName === 'string' ? obj.displayName : 'ex-miembro',
      avatarUrl: typeof obj.avatarUrl === 'string' ? obj.avatarUrl : null,
    }
  }
  return { displayName: 'ex-miembro', avatarUrl: null }
}

/**
 * Lista items NO archivados de una categoría, ordenados por
 * `Post.lastActivityAt DESC` (mismo criterio que discusiones — los
 * más recientes con actividad arriba).
 */
export async function listItemsByCategory(categoryId: string): Promise<LibraryItemListView[]> {
  const rows = await prisma.libraryItem.findMany({
    where: { categoryId, archivedAt: null },
    select: {
      id: true,
      authorUserId: true,
      coverUrl: true,
      category: { select: { slug: true, emoji: true, title: true } },
      post: {
        select: {
          id: true,
          slug: true,
          title: true,
          authorSnapshot: true,
          lastActivityAt: true,
          _count: { select: { comments: true } },
        },
      },
    },
    orderBy: { post: { lastActivityAt: 'desc' } },
  })
  return rows.map((r) => {
    const snap = readAuthorSnapshot(r.post.authorSnapshot)
    return {
      id: r.id,
      postId: r.post.id,
      postSlug: r.post.slug,
      categorySlug: r.category.slug,
      categoryEmoji: r.category.emoji,
      categoryTitle: r.category.title,
      title: r.post.title,
      coverUrl: r.coverUrl,
      authorUserId: r.authorUserId,
      authorDisplayName: snap.displayName,
      lastActivityAt: r.post.lastActivityAt,
      commentCount: r.post._count.comments,
    }
  })
}

/**
 * Top-N items globales del place ordenados por `Post.lastActivityAt
 * DESC`. Usado por `<RecentsList>` en `/library`.
 */
export async function listRecentItems(
  placeId: string,
  opts: { limit?: number } = {},
): Promise<LibraryItemListView[]> {
  const limit = Math.max(1, Math.min(opts.limit ?? 5, 20))
  const rows = await prisma.libraryItem.findMany({
    where: { placeId, archivedAt: null, category: { archivedAt: null } },
    select: {
      id: true,
      authorUserId: true,
      coverUrl: true,
      category: { select: { slug: true, emoji: true, title: true } },
      post: {
        select: {
          id: true,
          slug: true,
          title: true,
          authorSnapshot: true,
          lastActivityAt: true,
          _count: { select: { comments: true } },
        },
      },
    },
    orderBy: { post: { lastActivityAt: 'desc' } },
    take: limit,
  })
  return rows.map((r) => {
    const snap = readAuthorSnapshot(r.post.authorSnapshot)
    return {
      id: r.id,
      postId: r.post.id,
      postSlug: r.post.slug,
      categorySlug: r.category.slug,
      categoryEmoji: r.category.emoji,
      categoryTitle: r.category.title,
      title: r.post.title,
      coverUrl: r.coverUrl,
      authorUserId: r.authorUserId,
      authorDisplayName: snap.displayName,
      lastActivityAt: r.post.lastActivityAt,
      commentCount: r.post._count.comments,
    }
  })
}

/**
 * Resuelve un item por (categorySlug, postSlug) en el place. La URL
 * canónica del item es `/library/[categorySlug]/[postSlug]` — usamos
 * Post.slug porque LibraryItem no tiene slug propio (es el thread
 * documento, vive en Post).
 *
 * Devuelve `null` si la categoría o el item no existen, o si está
 * archivado y el viewer no es admin/author (la app gateaa eso desde
 * la page; acá la query solo filtra archivada según `includeArchived`).
 */
export async function findItemBySlug(
  placeId: string,
  categorySlug: string,
  postSlug: string,
  opts: { includeArchived?: boolean } = {},
): Promise<LibraryItemDetailView | null> {
  // Resolver category primero — slug es local al place pero tabla
  // tiene unique (placeId, slug).
  const category = await prisma.libraryCategory.findUnique({
    where: { placeId_slug: { placeId, slug: categorySlug } },
    select: { id: true, slug: true, emoji: true, title: true, archivedAt: true },
  })
  if (!category) return null
  if (!opts.includeArchived && category.archivedAt) return null

  // Resolver Post por (placeId, postSlug) y joinear LibraryItem.
  const post = await prisma.post.findUnique({
    where: { placeId_slug: { placeId, slug: postSlug } },
    select: {
      id: true,
      slug: true,
      title: true,
      body: true,
      authorSnapshot: true,
      createdAt: true,
      lastActivityAt: true,
      libraryItem: {
        select: {
          id: true,
          placeId: true,
          categoryId: true,
          authorUserId: true,
          coverUrl: true,
          archivedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  })
  if (!post || !post.libraryItem) return null
  const item = post.libraryItem
  if (item.categoryId !== category.id) return null
  if (!opts.includeArchived && item.archivedAt) return null

  return {
    id: item.id,
    placeId: item.placeId,
    categoryId: item.categoryId,
    categorySlug: category.slug,
    categoryEmoji: category.emoji,
    categoryTitle: category.title,
    postId: post.id,
    postSlug: post.slug,
    title: post.title,
    body: post.body,
    coverUrl: item.coverUrl,
    authorUserId: item.authorUserId,
    authorSnapshot: readAuthorSnapshot(post.authorSnapshot),
    archivedAt: item.archivedAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    postCreatedAt: post.createdAt,
    postLastActivityAt: post.lastActivityAt,
  }
}

/**
 * Resuelve un item por su id (para actions). Devuelve campos mínimos
 * + placeId/categoryId del item + authorUserId/postId/categorySlug
 * para usar en revalidate paths.
 */
export async function findItemForAction(itemId: string): Promise<{
  id: string
  placeId: string
  categoryId: string
  categorySlug: string
  postId: string
  postSlug: string
  authorUserId: string | null
  archivedAt: Date | null
} | null> {
  const row = await prisma.libraryItem.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      placeId: true,
      categoryId: true,
      authorUserId: true,
      archivedAt: true,
      category: { select: { slug: true } },
      post: { select: { id: true, slug: true } },
    },
  })
  if (!row) return null
  return {
    id: row.id,
    placeId: row.placeId,
    categoryId: row.categoryId,
    categorySlug: row.category.slug,
    postId: row.post.id,
    postSlug: row.post.slug,
    authorUserId: row.authorUserId,
    archivedAt: row.archivedAt,
  }
}
