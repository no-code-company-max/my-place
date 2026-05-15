'use server'

import { Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/db/client'
import { NotFoundError, ValidationError } from '@/shared/errors/domain-error'
import { logger } from '@/shared/lib/logger'
import { resolveLibraryViewer } from '@/features/library/public.server'
import { assertCategoryReadable } from '@/features/library/access/public.server'
import { markItemCompletedInputSchema } from '@/features/library/courses/schemas'

/**
 * Resultado de `markItemCompletedAction`. Idempotente — si el viewer
 * ya había marcado el item, retorna `alreadyCompleted: true` sin
 * tirar error.
 */
export type MarkItemCompletedResult = {
  ok: true
  alreadyCompleted: boolean
}

/**
 * Marca un item como completado por el viewer actual.
 *
 * Cualquier miembro activo puede marcar (D3 ADR `2026-05-04`), pero
 * SOLO si tiene read-access a la categoría — `assertCategoryReadable`
 * (Hallazgo #2, Plan A S3). Antes el comentario asumía que "el caller
 * ya validó read access": era falso (la page no lo hacía). Ahora el
 * gate vive acá, defensa en profundidad independiente del caller.
 *
 * Idempotencia: el insert tiene PK compuesta `(itemId, userId)`. Si
 * ya existe, Postgres tira P2002 → mapeamos a `alreadyCompleted: true`.
 *
 * NO chequeamos `category.kind === 'COURSE'` para evitar discriminar
 * en la action — si el viewer marca un item GENERAL (caso edge: UI
 * obsoleta o user sofisticado), la row queda escrita sin daño (UI
 * de GENERAL no muestra el botón ni el estado).
 */
export async function markItemCompletedAction(input: unknown): Promise<MarkItemCompletedResult> {
  const parsed = markItemCompletedInputSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationError('Datos inválidos para marcar item.', {
      issues: parsed.error.issues,
    })
  }
  const data = parsed.data

  const item = await prisma.libraryItem.findUnique({
    where: { id: data.itemId },
    select: {
      id: true,
      placeId: true,
      categoryId: true,
      archivedAt: true,
      category: { select: { slug: true } },
      post: { select: { slug: true } },
    },
  })
  if (!item) {
    throw new NotFoundError('Item no encontrado.', { itemId: data.itemId })
  }
  if (item.archivedAt) {
    throw new NotFoundError('Item archivado.', { itemId: data.itemId })
  }

  // Auth + membership + read-access (cached by request).
  const { viewer, actor } = await resolveLibraryViewer({ placeId: item.placeId })
  await assertCategoryReadable(item.categoryId, viewer)

  let alreadyCompleted = false
  try {
    await prisma.libraryItemCompletion.create({
      data: {
        itemId: item.id,
        userId: actor.actorId,
      },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      alreadyCompleted = true
      logger.info(
        {
          event: 'libraryItemMarkCompletedSkipped',
          placeId: actor.placeId,
          itemId: item.id,
          actorId: actor.actorId,
        },
        'item already completed; idempotent skip',
      )
    } else {
      throw err
    }
  }

  if (!alreadyCompleted) {
    logger.info(
      {
        event: 'libraryItemMarkCompleted',
        placeId: actor.placeId,
        itemId: item.id,
        actorId: actor.actorId,
      },
      'library item marked as completed',
    )
  }

  // Revalidate listing de la categoría (donde aparecen lock badges +
  // estado del item) y el detalle del item.
  revalidatePath(`/${actor.placeSlug}/library/${item.category.slug}`)
  revalidatePath(`/${actor.placeSlug}/library/${item.category.slug}/${item.post.slug}`)
  return { ok: true, alreadyCompleted }
}
