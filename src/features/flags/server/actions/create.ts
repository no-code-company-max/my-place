'use server'

/** Server action de creación de flags. */

import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import { prisma } from '@/db/client'
import { logger } from '@/shared/lib/logger'
import { NotFoundError, ValidationError } from '@/shared/errors/domain-error'
import { buildAuthorSnapshot } from '@/features/discussions/public'
import { FlagAlreadyExists } from '@/features/flags/domain/errors'
import { flagInputSchema } from '@/features/flags/schemas'
import { resolveActorForPlace, type FlagActor } from '@/features/flags/server/actor'

/** UNIQUE `(targetType, targetId, reporterUserId)` evita duplicados.
 *  No requiere place abierto — moderación es meta-nivel. */
export async function flagAction(input: unknown): Promise<{ ok: true; flagId: string }> {
  const data = parseFlagInput(input)
  const target = await resolveFlaggableTarget(data.targetType, data.targetId)
  const actor = await resolveActorForPlace({ placeId: target.placeId })
  const flagId = await createFlagOrConflict(data, target.placeId, actor)

  logger.info(
    {
      event: 'flagCreated',
      placeId: actor.placeId,
      targetType: data.targetType,
      targetId: data.targetId,
      flagId,
      reason: data.reason,
      actorId: actor.actorId,
    },
    'flag created',
  )

  revalidatePath(`/${actor.placeSlug}/settings/flags`)
  return { ok: true, flagId }
}

function parseFlagInput(input: unknown): ReturnType<typeof flagInputSchema.parse> {
  const parsed = flagInputSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationError('Datos inválidos.', { issues: parsed.error.issues })
  }
  return parsed.data
}

/**
 * Insert con guard de duplicado (UNIQUE `(targetType, targetId,
 * reporterUserId)`). Mapea P2002 → `FlagAlreadyExists` typed.
 *
 * `reporterSnapshot` se congela al momento de crear — patrón
 * Post/Comment/Event/LibraryItem. La cola admin lee del snapshot, no del
 * join con User; eso permite que erasure 365d nullifique `reporterUserId`
 * + reescriba el snapshot a `{ displayName: 'ex-miembro' }` sin romper la UI.
 */
async function createFlagOrConflict(
  data: ReturnType<typeof parseFlagInput>,
  placeId: string,
  actor: FlagActor,
): Promise<string> {
  const reporterSnapshot = buildAuthorSnapshot(actor.user)
  try {
    const created = await prisma.flag.create({
      data: {
        targetType: data.targetType,
        targetId: data.targetId,
        placeId,
        reporterUserId: actor.actorId,
        reporterSnapshot: reporterSnapshot as Prisma.InputJsonValue,
        reason: data.reason,
        reasonNote: data.reasonNote ?? null,
      },
      select: { id: true },
    })
    return created.id
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new FlagAlreadyExists({
        targetType: data.targetType,
        targetId: data.targetId,
        reporterUserId: actor.actorId,
      })
    }
    throw err
  }
}

async function resolveFlaggableTarget(
  targetType: 'POST' | 'COMMENT' | 'EVENT',
  targetId: string,
): Promise<{ placeId: string }> {
  if (targetType === 'POST') {
    const post = await prisma.post.findUnique({
      where: { id: targetId },
      select: { id: true, placeId: true },
    })
    if (!post) throw new NotFoundError('Post no encontrado.', { postId: targetId })
    return { placeId: post.placeId }
  }
  if (targetType === 'COMMENT') {
    const comment = await prisma.comment.findUnique({
      where: { id: targetId },
      select: { id: true, placeId: true, deletedAt: true },
    })
    if (!comment) {
      throw new NotFoundError('Comentario no encontrado.', { commentId: targetId })
    }
    if (comment.deletedAt) {
      throw new NotFoundError('Comentario ya fue eliminado.', { commentId: targetId })
    }
    return { placeId: comment.placeId }
  }
  // EVENT
  const event = await prisma.event.findUnique({
    where: { id: targetId },
    select: { id: true, placeId: true },
  })
  if (!event) throw new NotFoundError('Evento no encontrado.', { eventId: targetId })
  return { placeId: event.placeId }
}
