'use server'

import { prisma } from '@/db/client'
import { logger } from '@/shared/lib/logger'
import {
  AuthorizationError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '@/shared/errors/domain-error'
import { hidePostInputSchema, unhidePostInputSchema } from '@/features/discussions/schemas'
import { canAdminHide } from '@/features/discussions/domain/invariants'
import { resolveActorForPlace } from '@/features/discussions/server/actor'
import { revalidatePostPaths } from './shared'

/**
 * Admin oculta un Post (reversible). No lo borra; `hiddenAt` sólo se muestra
 * a admins con marca. Optimistic lock protege contra doble click.
 */
export async function hidePostAction(input: unknown): Promise<{ ok: true; version: number }> {
  const parsed = hidePostInputSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationError('Datos inválidos.', { issues: parsed.error.issues })
  }
  return togglePostHidden(parsed.data, 'hide')
}

export async function unhidePostAction(input: unknown): Promise<{ ok: true; version: number }> {
  const parsed = unhidePostInputSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationError('Datos inválidos.', { issues: parsed.error.issues })
  }
  return togglePostHidden(parsed.data, 'unhide')
}

async function togglePostHidden(
  data: { postId: string; expectedVersion: number },
  mode: 'hide' | 'unhide',
): Promise<{ ok: true; version: number }> {
  const post = await prisma.post.findUnique({
    where: { id: data.postId },
    select: { id: true, placeId: true, slug: true },
  })
  if (!post) {
    throw new NotFoundError('Post no encontrado.', { postId: data.postId })
  }

  const actor = await resolveActorForPlace({ placeId: post.placeId })
  if (!canAdminHide(actor)) {
    throw new AuthorizationError('Sólo admins pueden ocultar/revelar posts.', {
      postId: post.id,
    })
  }

  const nextVersion = data.expectedVersion + 1
  const updated = await prisma.post.updateMany({
    where: { id: post.id, version: data.expectedVersion },
    data: { hiddenAt: mode === 'hide' ? new Date() : null, version: nextVersion },
  })
  if (updated.count === 0) {
    throw new ConflictError('El post cambió desde que lo abriste.', {
      postId: post.id,
      expectedVersion: data.expectedVersion,
    })
  }

  logger.info(
    {
      event: mode === 'hide' ? 'postHidden' : 'postUnhidden',
      placeId: actor.placeId,
      postId: post.id,
      actorId: actor.actorId,
    },
    mode === 'hide' ? 'post hidden' : 'post unhidden',
  )

  revalidatePostPaths(actor.placeSlug, post.slug)
  return { ok: true, version: nextVersion }
}
