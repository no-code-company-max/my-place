'use server'

import { prisma } from '@/db/client'
import { logger } from '@/shared/lib/logger'
import {
  AuthorizationError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '@/shared/errors/domain-error'
import { deleteCommentInputSchema } from '@/features/discussions/schemas'
import {
  assertCommentAlive,
  canDeleteContent,
  editWindowOpen,
} from '@/features/discussions/domain/invariants'
import { EditWindowExpired } from '@/features/discussions/domain/errors'
import { hasPermission } from '@/features/members/public.server'
import { resolveActorForPlace } from '@/features/discussions/server/actor'
import { revalidateCommentPaths } from './shared'

/** Soft delete. Autor dentro de 60s; admin siempre. Body se preserva
 *  (UI miembro renderiza `[mensaje eliminado]`; admin lo ve raw). */
export async function deleteCommentAction(input: unknown): Promise<{ ok: true; version: number }> {
  const parsed = deleteCommentInputSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationError('Datos inválidos.', { issues: parsed.error.issues })
  }
  const data = parsed.data

  const comment = await prisma.comment.findUnique({
    where: { id: data.commentId },
    select: {
      id: true,
      placeId: true,
      postId: true,
      authorUserId: true,
      createdAt: true,
      deletedAt: true,
      post: { select: { slug: true } },
    },
  })
  if (!comment) throw new NotFoundError('Comentario no encontrado.', { commentId: data.commentId })
  assertCommentAlive(comment)

  const actor = await resolveActorForPlace({ placeId: comment.placeId })
  const now = new Date()
  const canModerate = await hasPermission(
    actor.actorId,
    actor.placeId,
    'discussions:delete-comment',
  )

  const allowed = canDeleteContent(
    { ...actor, isAdmin: canModerate },
    comment.authorUserId,
    comment.createdAt,
    now,
  )
  if (!allowed) {
    // Error más específico cuando el problema es la ventana del autor.
    if (
      !canModerate &&
      comment.authorUserId === actor.actorId &&
      !editWindowOpen(comment.createdAt, now)
    ) {
      throw new EditWindowExpired({
        entityId: comment.id,
        createdAt: comment.createdAt,
        now,
        elapsedMs: now.getTime() - comment.createdAt.getTime(),
      })
    }
    throw new AuthorizationError('No podés borrar este comentario.', { commentId: comment.id })
  }

  const nextVersion = data.expectedVersion + 1
  const updated = await prisma.comment.updateMany({
    where: { id: comment.id, version: data.expectedVersion, deletedAt: null },
    data: { deletedAt: now, version: nextVersion },
  })
  if (updated.count === 0) {
    throw new ConflictError('El comentario cambió desde que lo abriste.', {
      commentId: comment.id,
      expectedVersion: data.expectedVersion,
    })
  }

  logger.info(
    {
      event: 'commentDeleted',
      placeId: actor.placeId,
      postId: comment.postId,
      commentId: comment.id,
      actorId: actor.actorId,
      byAdmin: canModerate && comment.authorUserId !== actor.actorId,
    },
    'comment deleted',
  )
  revalidateCommentPaths(actor.placeSlug, comment.post.slug, 'delete')
  return { ok: true, version: nextVersion }
}
