'use server'

import { prisma } from '@/db/client'
import { AuthorizationError, NotFoundError, ValidationError } from '@/shared/errors/domain-error'
import { logger } from '@/shared/lib/logger'
import { resolveActorForPlace } from '@/features/discussions/public.server'
import { canArchiveItem } from '@/features/library/public'
import { archiveItemInputSchema } from '@/features/library/schemas'
import { revalidateLibraryItemPaths } from './shared'

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
      archivedAt: true,
      category: { select: { slug: true } },
      post: { select: { slug: true } },
    },
  })
  if (!item) {
    throw new NotFoundError('Item no encontrado.', { itemId: data.itemId })
  }

  const actor = await resolveActorForPlace({ placeId: item.placeId })
  if (
    !canArchiveItem(
      { authorUserId: item.authorUserId },
      { userId: actor.actorId, isAdmin: actor.isAdmin },
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
