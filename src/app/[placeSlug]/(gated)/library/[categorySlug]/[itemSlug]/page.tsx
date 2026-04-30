import { notFound } from 'next/navigation'
import { prisma } from '@/db/client'
import { loadPlaceBySlug } from '@/shared/lib/place-loader'
import { logger } from '@/shared/lib/logger'
import {
  CommentThread,
  DwellTracker,
  PostReadersBlock,
  ReactionBar,
  RichTextRenderer,
  ThreadHeaderBar,
  ThreadPresence,
  aggregateReactions,
  findOrCreateCurrentOpening,
  listCommentsByPost,
  listReadersByPost,
  reactionMapKey,
  resolveViewerForPlace,
  type PostReader,
  type QuoteTargetState,
  type ReactionAggregationMap,
  type RichTextDocument,
} from '@/features/discussions/public'
import {
  ItemAdminMenu,
  LibraryItemHeader,
  canArchiveItem,
  canEditItem,
} from '@/features/library/public'
import { findItemBySlug } from '@/features/library/public.server'

type Props = {
  params: Promise<{ placeSlug: string; categorySlug: string; itemSlug: string }>
}

/**
 * Detalle del item de biblioteca (R.7.9). URL canónica:
 * `/library/[categorySlug]/[itemSlug]`. El `itemSlug` URL coincide
 * con `Post.slug` — el item ES el thread documento.
 *
 * Render:
 *   - ThreadHeaderBar sticky (con kebab admin/author si corresponde).
 *   - LibraryItemHeader (chip categoría + título + author + meta).
 *   - RichTextRenderer del Post.body (con embed nodes intercalados).
 *   - ReactionBar standalone sobre el Post.
 *   - PostReadersBlock + DwellTracker + ThreadPresence (reuse).
 *   - CommentThread + composer (reuse).
 *
 * Archivado: solo admin/author lo ven (RLS lo enforce + acá filtramos
 * con `canArchiveItem` para el "Archivado" badge en el header).
 *
 * Ver `docs/features/library/spec.md` § 14.9 + § 13 (cross-zona).
 */
export default async function LibraryItemDetailPage({ params }: Props) {
  const { placeSlug, categorySlug, itemSlug } = await params

  const place = await loadPlaceBySlug(placeSlug)
  if (!place) notFound()

  const [item, viewer, opening] = await Promise.all([
    findItemBySlug(place.id, categorySlug, itemSlug, { includeArchived: true }),
    resolveViewerForPlace({ placeSlug }),
    findOrCreateCurrentOpening(place.id).catch((err: unknown) => {
      logger.error({ err, placeId: place.id }, 'failed to materialize opening')
      return null
    }),
  ])
  if (!item) notFound()

  // Si está archivado: solo admin o author lo ven.
  const viewerCtx = { userId: viewer.actorId, isAdmin: viewer.isAdmin }
  const itemCtx = { authorUserId: item.authorUserId }
  if (item.archivedAt && !canArchiveItem(itemCtx, viewerCtx)) notFound()

  const canEdit = canEditItem(itemCtx, viewerCtx)
  const canArchive = canArchiveItem(itemCtx, viewerCtx)

  const [{ items: comments, nextCursor }, reactionsByKey, quoteStateByCommentId, readers] =
    await Promise.all([
      listCommentsByPost({ postId: item.postId, includeDeleted: viewer.isAdmin }),
      aggregateReactions({
        targets: [{ type: 'POST', id: item.postId }],
        viewerUserId: viewer.actorId,
      }) as Promise<ReactionAggregationMap>,
      Promise.resolve(new Map<string, QuoteTargetState>()),
      opening
        ? listReadersByPost({
            postId: item.postId,
            placeId: place.id,
            placeOpeningId: opening.id,
            excludeUserId: viewer.actorId,
          })
        : Promise.resolve([] as PostReader[]),
    ])

  // Aggregate reactions de los comments (segunda llamada, depende de
  // la lista) — se podría unir al primer batch pero mantener separado
  // mantiene paridad con conversations/[postSlug]/page.tsx.
  const commentReactions =
    comments.length > 0
      ? ((await aggregateReactions({
          targets: comments.map((c) => ({ type: 'COMMENT' as const, id: c.id })),
          viewerUserId: viewer.actorId,
        })) as ReactionAggregationMap)
      : new Map()

  // Merge ambos maps para pasar al CommentThread.
  for (const [k, v] of commentReactions) reactionsByKey.set(k, v)

  // Resolve quote target states (los comments del item pueden citar
  // otros comments del mismo thread — flow standard de discussions).
  const quoteIds = comments.map((c) => c.quotedCommentId).filter((v): v is string => v !== null)
  if (quoteIds.length > 0) {
    const rows = await prisma.comment.findMany({
      where: { id: { in: quoteIds } },
      select: { id: true, deletedAt: true },
    })
    for (const row of rows) {
      quoteStateByCommentId.set(row.id, row.deletedAt ? 'DELETED' : 'VISIBLE')
    }
  }

  return (
    <div className="pb-32">
      <ThreadHeaderBar
        rightSlot={
          canEdit || canArchive ? (
            <ItemAdminMenu
              itemId={item.id}
              categorySlug={item.categorySlug}
              postSlug={item.postSlug}
              canEdit={canEdit}
              canArchive={canArchive}
            />
          ) : null
        }
      />

      <DwellTracker postId={item.postId} />
      <ThreadPresence
        postId={item.postId}
        viewer={{
          userId: viewer.actorId,
          displayName: viewer.user.displayName,
          avatarUrl: viewer.user.avatarUrl,
        }}
      />

      <LibraryItemHeader item={item} />

      <article className="prose-place mx-3 mt-3 max-w-none text-text">
        {item.body ? (
          <RichTextRenderer doc={item.body as RichTextDocument} placeSlug={viewer.placeSlug} />
        ) : null}
      </article>

      <div className="mx-3 mt-6 border-t-[0.5px] border-border" />

      <div className="px-3 pt-4">
        <ReactionBar
          targetType="POST"
          targetId={item.postId}
          initial={reactionsByKey.get(reactionMapKey('POST', item.postId)) ?? []}
        />
      </div>

      <div className="mt-3">
        <PostReadersBlock readers={readers} />
      </div>

      <CommentThread
        postId={item.postId}
        placeSlug={viewer.placeSlug}
        viewerUserId={viewer.actorId}
        viewerIsAdmin={viewer.isAdmin}
        items={comments}
        nextCursor={
          nextCursor ? { createdAt: nextCursor.createdAt.toISOString(), id: nextCursor.id } : null
        }
        reactionsByKey={reactionsByKey}
        quoteStateByCommentId={quoteStateByCommentId}
      />
    </div>
  )
}
