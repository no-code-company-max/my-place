'use server'

import { prisma } from '@/db/client'
import { AuthorizationError, ConflictError, ValidationError } from '@/shared/errors/domain-error'
import { logger } from '@/shared/lib/logger'
import { resolveActorForPlace } from '@/features/discussions/public.server'
import { hasPermission } from '@/features/members/public.server'
import { reorderCategoriesInputSchema } from '@/features/library/schemas'
import { revalidateLibraryCategoryPaths } from '@/features/library/public.server'
import { acquireCategorySetLock } from './_with-category-set-lock'

/**
 * Reordena las categorías de un place según el array provisto.
 *
 * El index del array es la posición visual final (0-based). La action
 * actualiza `position` en una transacción para que ningún viewer vea
 * estado inconsistente (medio reordenado).
 *
 * Validaciones:
 *  - Todos los `categoryIds` deben pertenecer al `placeId` del actor.
 *  - El set debe matchear EXACTO el conjunto de categorías no
 *    archivadas del place (sin omisiones, sin extras). Si admin agregó
 *    una categoría mientras el cliente tenía un drag abierto, el
 *    submit falla con `ConflictError` y la UI debe re-fetchear.
 *
 * No reordena archivadas — vivirían fuera del listado visible.
 */
export async function reorderLibraryCategoriesAction(
  input: unknown,
): Promise<{ ok: true; updated: number }> {
  const parsed = reorderCategoriesInputSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationError('Datos inválidos para reordenar categorías.', {
      issues: parsed.error.issues,
    })
  }
  const data = parsed.data

  const actor = await resolveActorForPlace({ placeId: data.placeId })
  // G.3: gate atómico permission-groups. Reorder es global (cualquier
  // permission scope a categoría no aplica al ordenamiento del set).
  // Aceptamos la versión global del permiso `library:moderate-categories`.
  const allowed = await hasPermission(actor.actorId, actor.placeId, 'library:moderate-categories')
  if (!allowed) {
    throw new AuthorizationError('No tenés permiso para reordenar categorías.', {
      placeId: actor.placeId,
      actorId: actor.actorId,
    })
  }

  // El SET check y los UPDATEs corren bajo el advisory lock por place
  // para serializar contra create / archive concurrentes. Sin el lock,
  // entre el `findMany` y los UPDATEs otra TX podría agregar/archivar
  // categorías y dejar el set inconsistente (TOCTOU).
  const updated = await prisma.$transaction(async (tx) => {
    await acquireCategorySetLock(tx, actor.placeId)

    const live = await tx.libraryCategory.findMany({
      where: { placeId: actor.placeId, archivedAt: null },
      select: { id: true },
    })
    const liveIds = new Set(live.map((c) => c.id))
    const inputSet = new Set(data.orderedCategoryIds)

    if (liveIds.size !== inputSet.size || ![...liveIds].every((id) => inputSet.has(id))) {
      throw new ConflictError('La lista de categorías cambió mientras reordenabas.', {
        placeId: actor.placeId,
        liveCount: liveIds.size,
        inputCount: inputSet.size,
      })
    }

    return Promise.all(
      data.orderedCategoryIds.map((id, index) =>
        tx.libraryCategory.update({
          where: { id },
          data: { position: index },
        }),
      ),
    )
  })

  logger.info(
    {
      event: 'libraryCategoriesReordered',
      placeId: actor.placeId,
      count: updated.length,
      actorId: actor.actorId,
    },
    'library categories reordered',
  )

  revalidateLibraryCategoryPaths(actor.placeSlug, undefined, actor.placeId)
  return { ok: true, updated: updated.length }
}
