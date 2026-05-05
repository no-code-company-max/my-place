'use server'

import { prisma } from '@/db/client'
import { AuthorizationError, NotFoundError, ValidationError } from '@/shared/errors/domain-error'
import { logger } from '@/shared/lib/logger'
import { hasPermission } from '@/features/members/public.server'
import { canArchiveItem } from '@/features/library/public'
import { archiveItemInputSchema } from '@/features/library/schemas'
import { resolveLibraryViewer, revalidateLibraryItemPaths } from '@/features/library/public.server'

/**
 * Archiva un item de biblioteca (soft-delete via `archivedAt`).
 *
 * El thread (Post) NO se archiva — sigue vivo en `/conversations`
 * porque la conversación generada alrededor del item es valor
 * preservado del place. Si el item se restaura, el thread sigue
 * activo. Esto es consistente con el comportamiento de Event.cancel:
 * cancelled → thread sigue.
 *
 * Permitido para admin/owner del place o author del item.
 * Idempotente: si ya está archivado, retorna `alreadyArchived:true`.
 */
export async function archiveLibraryItemAction(
  input: unknown,
): Promise<{ ok: true; itemId: string; alreadyArchived: boolean }> {
  const parsed = archiveItemInputSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationError('Datos inválidos para archivar item.', {
      issues: parsed.error.issues,
    })
  }
  const data = parsed.data

  const item = await prisma.libraryItem.findUnique({
    where: { id: data.itemId },
    select: {
      id: true,
      placeId: true,
      authorUserId: true,
      categoryId: true,
      archivedAt: true,
      category: { select: { slug: true } },
      post: { select: { slug: true } },
    },
  })
  if (!item) {
    throw new NotFoundError('Item no encontrado.', { itemId: data.itemId })
  }

  const { viewer, actor } = await resolveLibraryViewer({ placeId: item.placeId })
  // G.3: gate atómico permission-groups, scopable por categoría. El author
  // siempre puede archivar su propio item (canArchiveItem mantiene esa rama).
  // El viewer real puede no ser admin pero tener `library:moderate-items`
  // para ESTA categoría — override `isAdmin` con el resultado del perm
  // check granular para que `canArchiveItem` lo respete.
  const canModerate = await hasPermission(actor.actorId, actor.placeId, 'library:moderate-items', {
    categoryId: item.categoryId,
  })
  if (
    !canArchiveItem(
      { authorUserId: item.authorUserId },
      { ...viewer, isAdmin: canModerate || viewer.isAdmin },
    )
  ) {
    throw new AuthorizationError('No tenés permiso para archivar este item.', {
      placeId: actor.placeId,
      itemId: item.id,
      actorId: actor.actorId,
    })
  }

  if (item.archivedAt) {
    logger.info(
      {
        event: 'libraryItemArchiveSkipped',
        placeId: actor.placeId,
        itemId: item.id,
        actorId: actor.actorId,
      },
      'item already archived; skipping',
    )
    return { ok: true, itemId: item.id, alreadyArchived: true }
  }

  await prisma.libraryItem.update({
    where: { id: item.id },
    data: { archivedAt: new Date() },
  })

  logger.info(
    {
      event: 'libraryItemArchived',
      placeId: actor.placeId,
      itemId: item.id,
      actorId: actor.actorId,
    },
    'library item archived',
  )

  revalidateLibraryItemPaths(actor.placeSlug, item.category.slug, item.post.slug)
  return { ok: true, itemId: item.id, alreadyArchived: false }
}
