'use server'

/** Server action de revisión de flags (admin). */

import { revalidatePath } from 'next/cache'
import { prisma } from '@/db/client'
import { logger } from '@/shared/lib/logger'
import { AuthorizationError, NotFoundError, ValidationError } from '@/shared/errors/domain-error'
import { hardDeletePost } from '@/features/discussions/public.server'
import { cancelEventInTx } from '@/features/events/public.server'
import { reviewFlagInputSchema } from '@/features/flags/schemas'
import { hasPermission } from '@/features/members/public.server'
import { resolveActorForPlace, type FlagActor } from '@/features/flags/server/actor'

type FlagRecord = {
  id: string
  placeId: string
  status: string
  targetType: 'POST' | 'COMMENT' | 'EVENT'
  targetId: string
}

type ReviewInput = ReturnType<typeof parseReviewInput>

/** Admin marca REVIEWED_ACTIONED o REVIEWED_DISMISSED. No reabre.
 *  sideEffect combina update + side-effect sobre target en una tx.
 *  Hard delete sobre POST sale fuera de la tx (hardDeletePost dropea
 *  el flag row internamente). Concurrencia: `updateMany status=OPEN`
 *  como guard — count=0 ⇒ NotFoundError. */
export async function reviewFlagAction(input: unknown): Promise<{ ok: true }> {
  const data = parseReviewInput(input)
  const { flag, actor } = await loadAndAuthorizeFlag(data)

  if (data.sideEffect === 'DELETE_TARGET' && flag.targetType === 'POST') {
    await reviewFlagPostHardDelete(flag, actor, data)
    return { ok: true }
  }

  const targetPostSlug = await reviewFlagTx(flag, actor, data)
  logFlagReviewed(actor, flag, data)
  revalidateFlagPaths(actor, flag, data, targetPostSlug)
  return { ok: true }
}

function parseReviewInput(input: unknown) {
  const parsed = reviewFlagInputSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationError('Datos inválidos.', { issues: parsed.error.issues })
  }
  return parsed.data
}

async function loadAndAuthorizeFlag(
  data: ReviewInput,
): Promise<{ flag: FlagRecord; actor: FlagActor }> {
  const flag = await prisma.flag.findUnique({
    where: { id: data.flagId },
    select: { id: true, placeId: true, status: true, targetType: true, targetId: true },
  })
  if (!flag) throw new NotFoundError('Flag no encontrado.', { flagId: data.flagId })

  const actor = await resolveActorForPlace({ placeId: flag.placeId })
  const allowed = await hasPermission(actor.actorId, actor.placeId, 'flags:review')
  if (!allowed) {
    throw new AuthorizationError('No tenés permiso para revisar flags.', { flagId: flag.id })
  }

  if (data.sideEffect === 'HIDE_TARGET' && flag.targetType === 'COMMENT') {
    throw new ValidationError('Los comentarios se eliminan, no se ocultan.', {
      flagId: flag.id,
      targetType: flag.targetType,
    })
  }

  if (
    flag.targetType === 'EVENT' &&
    (data.sideEffect === 'HIDE_TARGET' || data.sideEffect === 'DELETE_TARGET')
  ) {
    // Eventos se cancelan, no se ocultan ni borran (sideEffect correcto: CANCEL_EVENT).
    throw new ValidationError('Los eventos se cancelan, no se ocultan ni se eliminan.', {
      flagId: flag.id,
      targetType: flag.targetType,
      sideEffect: data.sideEffect,
    })
  }

  if (data.sideEffect === 'CANCEL_EVENT' && flag.targetType !== 'EVENT') {
    throw new ValidationError('CANCEL_EVENT sólo aplica a flags sobre eventos.', {
      flagId: flag.id,
      targetType: flag.targetType,
    })
  }

  return { flag: flag as FlagRecord, actor }
}

/** Fuera de tx porque hardDeletePost borra el flag internamente. */
async function reviewFlagPostHardDelete(
  flag: FlagRecord,
  actor: FlagActor,
  data: ReviewInput,
): Promise<void> {
  const post = await prisma.post.findUnique({
    where: { id: flag.targetId },
    select: { slug: true },
  })
  if (!post) throw new NotFoundError('Post ya fue eliminado.', { postId: flag.targetId })

  const claimed = await prisma.flag.updateMany({
    where: { id: flag.id, status: 'OPEN' },
    data: {
      status: data.decision,
      reviewedAt: new Date(),
      reviewerAdminUserId: actor.actorId,
      reviewNote: data.reviewNote ?? null,
    },
  })
  if (claimed.count === 0) {
    throw new NotFoundError('El flag ya fue resuelto por otro admin.', { flagId: flag.id })
  }

  await hardDeletePost(flag.targetId)
  logFlagReviewed(actor, flag, data)
  revalidatePath(`/${actor.placeSlug}/settings/flags`)
  revalidatePath(`/${actor.placeSlug}/conversations`)
  revalidatePath(`/${actor.placeSlug}/conversations/${post.slug}`)
}

/** Update flag + sideEffect en una tx. Retorna targetPostSlug para revalidate. */
async function reviewFlagTx(
  flag: FlagRecord,
  actor: FlagActor,
  data: ReviewInput,
): Promise<string | null> {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.flag.updateMany({
      where: { id: flag.id, status: 'OPEN' },
      data: {
        status: data.decision,
        reviewedAt: new Date(),
        reviewerAdminUserId: actor.actorId,
        reviewNote: data.reviewNote ?? null,
      },
    })
    if (updated.count === 0) {
      throw new NotFoundError('El flag ya fue resuelto por otro admin.', { flagId: flag.id })
    }
    if (data.sideEffect === null) return null

    if (flag.targetType === 'EVENT') {
      await cancelEventInTx(tx, flag.targetId)
      return null
    }

    if (flag.targetType === 'POST') {
      const post = await tx.post.update({
        where: { id: flag.targetId },
        data: { hiddenAt: new Date() },
        select: { slug: true },
      })
      return post.slug
    }

    const comment = await tx.comment.update({
      where: { id: flag.targetId },
      data: { deletedAt: new Date() },
      select: { postId: true },
    })
    const parentPost = await tx.post.findUnique({
      where: { id: comment.postId },
      select: { slug: true },
    })
    return parentPost?.slug ?? null
  })
}

function logFlagReviewed(actor: FlagActor, flag: FlagRecord, data: ReviewInput): void {
  logger.info(
    {
      event: 'flagReviewed',
      placeId: actor.placeId,
      flagId: flag.id,
      decision: data.decision,
      sideEffect: data.sideEffect,
      targetType: flag.targetType,
      targetId: flag.targetId,
      actorId: actor.actorId,
    },
    'flag reviewed',
  )
}

function revalidateFlagPaths(
  actor: FlagActor,
  flag: FlagRecord,
  data: ReviewInput,
  targetPostSlug: string | null,
): void {
  revalidatePath(`/${actor.placeSlug}/settings/flags`)
  if (data.sideEffect === null) return
  if (flag.targetType === 'EVENT') {
    revalidatePath(`/${actor.placeSlug}/events`)
    return
  }
  if (flag.targetType === 'POST') {
    revalidatePath(`/${actor.placeSlug}/conversations`)
    if (targetPostSlug) revalidatePath(`/${actor.placeSlug}/conversations/${targetPostSlug}`)
  } else if (data.sideEffect === 'DELETE_TARGET' && targetPostSlug) {
    revalidatePath(`/${actor.placeSlug}/conversations/${targetPostSlug}`)
  }
}
