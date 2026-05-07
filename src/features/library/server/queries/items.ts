import 'server-only'
import { prisma } from '@/db/client'
import type {
  ItemAuthorSnapshot,
  LibraryItemDetailView,
  LibraryItemListView,
} from '@/features/library/domain/types'

/**
 * Queries de items. URL canónica `/library/[categorySlug]/[postSlug]` —
 * el item ES el thread documento (vive en Post; LibraryItem no tiene slug
 * propio). Service role bypassea RLS, caller gateaa membership.
 */

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

/** Select compartido entre listings (categoría + recents). */
const ITEM_LIST_SELECT = {
  id: true,
  authorUserId: true,
  authorSnapshot: true,
  coverUrl: true,
  prereqItemId: true,
  category: { select: { slug: true, emoji: true, title: true } },
  post: {
    select: {
      id: true,
      slug: true,
      title: true,
      lastActivityAt: true,
      _count: { select: { comments: true } },
    },
  },
} as const

type ItemListRow = {
  id: string
  authorUserId: string | null
  authorSnapshot: unknown
  coverUrl: string | null
  prereqItemId: string | null
  category: { slug: string; emoji: string; title: string }
  post: {
    id: string
    slug: string
    title: string
    lastActivityAt: Date
    _count: { comments: number }
  }
}

function mapItemListRow(r: ItemListRow): LibraryItemListView {
  const snap = readAuthorSnapshot(r.authorSnapshot)
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
    prereqItemId: r.prereqItemId,
  }
}

/** Items NO archivados de una categoría, orden Post.lastActivityAt DESC. */
export async function listItemsByCategory(categoryId: string): Promise<LibraryItemListView[]> {
  const rows = await prisma.libraryItem.findMany({
    where: { categoryId, archivedAt: null },
    select: ITEM_LIST_SELECT,
    orderBy: { post: { lastActivityAt: 'desc' } },
  })
  return rows.map(mapItemListRow)
}

/** Top-N items globales del place, orden Post.lastActivityAt DESC. */
export async function listRecentItems(
  placeId: string,
  opts: { limit?: number } = {},
): Promise<LibraryItemListView[]> {
  const limit = Math.max(1, Math.min(opts.limit ?? 5, 20))
  const rows = await prisma.libraryItem.findMany({
    where: { placeId, archivedAt: null, category: { archivedAt: null } },
    select: ITEM_LIST_SELECT,
    orderBy: { post: { lastActivityAt: 'desc' } },
    take: limit,
  })
  return rows.map(mapItemListRow)
}

/** Resuelve item por (categorySlug, postSlug). null si no existe o
 *  archivado y `includeArchived` no se pasa. */
export async function findItemBySlug(
  placeId: string,
  categorySlug: string,
  postSlug: string,
  opts: { includeArchived?: boolean } = {},
): Promise<LibraryItemDetailView | null> {
  // 1 query: post por (placeId, slug) + libraryItem + category anidados.
  // Validamos pertenencia a la categoría en memoria sobre el slug de la
  // category nested — evita el round-trip extra a libraryCategory.
  const post = await prisma.post.findUnique({
    where: { placeId_slug: { placeId, slug: postSlug } },
    select: {
      id: true,
      slug: true,
      title: true,
      body: true,
      version: true,
      createdAt: true,
      lastActivityAt: true,
      libraryItem: {
        select: {
          id: true,
          placeId: true,
          categoryId: true,
          authorUserId: true,
          authorSnapshot: true,
          coverUrl: true,
          prereqItemId: true,
          archivedAt: true,
          createdAt: true,
          updatedAt: true,
          category: {
            select: { id: true, slug: true, emoji: true, title: true, archivedAt: true },
          },
        },
      },
    },
  })
  if (!post || !post.libraryItem) return null
  const item = post.libraryItem
  if (item.category.slug !== categorySlug) return null
  if (!opts.includeArchived && item.category.archivedAt) return null
  if (!opts.includeArchived && item.archivedAt) return null

  return {
    id: item.id,
    placeId: item.placeId,
    categoryId: item.categoryId,
    categorySlug: item.category.slug,
    categoryEmoji: item.category.emoji,
    categoryTitle: item.category.title,
    postId: post.id,
    postSlug: post.slug,
    title: post.title,
    body: post.body,
    postVersion: post.version,
    coverUrl: item.coverUrl,
    authorUserId: item.authorUserId,
    authorSnapshot: readAuthorSnapshot(item.authorSnapshot),
    prereqItemId: item.prereqItemId,
    archivedAt: item.archivedAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    postCreatedAt: post.createdAt,
    postLastActivityAt: post.lastActivityAt,
  }
}

/** Resuelve item por id para actions (campos mínimos + paths para revalidate). */
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
