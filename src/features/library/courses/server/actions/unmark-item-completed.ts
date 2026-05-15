'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/db/client'
import { NotFoundError, ValidationError } from '@/shared/errors/domain-error'
import { logger } from '@/shared/lib/logger'
import { resolveActorForPlace } from '@/features/discussions/public.server'
import { unmarkItemCompletedInputSchema } from '@/features/library/courses/schemas'

/**
 * Resultado de `unmarkItemCompletedAction`. Idempotente — si el viewer
 * nunca había marcado el item, retorna `{ ok: true }` (count=0) sin
 * tirar error.
 */
export type UnmarkItemCompletedResult = { ok: true }

/**
 * Desmarca un item para el viewer actual.
 *
 * Idempotente: `deleteMany` por (itemId, userId) — si no había row,
 * count=0 y la action retorna ok igual. No diferenciamos "estaba
 * marcado" vs "no estaba" porque desde la UI el botón Mark Complete
 * siempre puede invocarse y el resultado neto es el mismo (no marcado).
 *
 * Permite desmarcar incluso si el item está archivado — el viewer
 * puede querer hacer cleanup de su completion list. Único gate: auth +
 * existencia del item.
 *
 * Hallazgo #2 (Plan A S3): a diferencia de `markItemCompletedAction`,
 * acá NO se aplica `assertCategoryReadable` — decisión consciente, no
 * olvido. `deleteMany` solo borra completion PROPIA del viewer: no lee
 * body ni títulos (cero fuga de confidencialidad) y gatear read-access
 * rompería el caso legítimo "perdí acceso a la categoría, quiero
 * limpiar mi lista" que esta action soporta a propósito.
 */
export async function unmarkItemCompletedAction(
  input: unknown,
): Promise<UnmarkItemCompletedResult> {
  const parsed = unmarkItemCompletedInputSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationError('Datos inválidos para desmarcar item.', {
      issues: parsed.error.issues,
    })
  }
  const data = parsed.data

  const item = await prisma.libraryItem.findUnique({
    where: { id: data.itemId },
    select: {
      id: true,
      placeId: true,
      archivedAt: true,
      category: { select: { slug: true } },
      post: { select: { slug: true } },
    },
  })
  if (!item) {
    throw new NotFoundError('Item no encontrado.', { itemId: data.itemId })
  }

  const actor = await resolveActorForPlace({ placeId: item.placeId })

  const result = await prisma.libraryItemCompletion.deleteMany({
    where: { itemId: item.id, userId: actor.actorId },
  })

  logger.info(
    {
      event: 'libraryItemUnmarkCompleted',
      placeId: actor.placeId,
      itemId: item.id,
      actorId: actor.actorId,
      removedCount: result.count,
    },
    'library item completion removed',
  )

  // Revalidate listing de la categoría (donde aparecen lock badges) y el
  // detalle del item (estado del Mark Complete button).
  revalidatePath(`/${actor.placeSlug}/library/${item.category.slug}`)
  revalidatePath(`/${actor.placeSlug}/library/${item.category.slug}/${item.post.slug}`)
  return { ok: true }
}
