'use server'

import { prisma } from '@/db/client'
import { logger } from '@/shared/lib/logger'
import { AuthorizationError, NotFoundError, ValidationError } from '@/shared/errors/domain-error'
import { resolveActorForPlace } from '@/features/discussions/public.server'
import { hasPermission } from '@/features/members/public.server'
import { setLibraryCategoryDesignatedContributorsInputSchema } from '@/features/library/schemas'
import { revalidateLibraryCategoryPaths } from '@/features/library/public.server'

/**
 * Resultado de `setLibraryCategoryDesignatedContributorsAction` —
 * discriminated union.
 *
 * - `member_not_in_place`: alguno de los `userIds` pasados no es miembro
 *   activo del place de la categoría. Defense in depth contra payloads
 *   manipulados o stale (ej. miembro que dejó el place entre el render
 *   del form y el submit).
 */
export type SetLibraryCategoryDesignatedContributorsResult =
  | { ok: true }
  | { ok: false; error: 'member_not_in_place' }

/**
 * Setea (override completo) la lista de miembros designados
 * (`LibraryCategoryContributor`) de una categoría. Mirror semántico de
 * `setLibraryCategoryGroupScopeAction` pero para users.
 *
 * Pasar `userIds: []` deja la categoría sin contributors — efecto default
 * cerrado: nadie no-owner puede contribuir aunque policy=DESIGNATED.
 *
 * Permission: `library:moderate-categories` con scope a esta categoría
 * (consistente con `inviteContributorAction`/`removeContributorAction`).
 * Owner siempre tiene esta perm via bypass.
 *
 * Flow:
 *  1. Parse Zod.
 *  2. Load category + actor + permission gate.
 *  3. Si hay userIds, valida que TODOS sean miembros activos del place →
 *     `member_not_in_place` si alguno está fuera o tiene `leftAt`.
 *  4. Tx: deleteMany existing + createMany del nuevo set.
 *
 * Reemplaza el patrón "N inviteContributor + M removeContributor" del
 * form-sheet — un solo round-trip + sin race conditions entre los N+M
 * writes (ver gotcha hours docs/ux-patterns.md).
 *
 * NO valida `category.contributionPolicy === 'DESIGNATED'` por la misma
 * razón que `setLibraryCategoryGroupScopeAction`: el owner puede preasignar
 * contributors antes de cambiar la policy. Si la policy es otra, las filas
 * en `LibraryCategoryContributor` existen pero no se evalúan en
 * `canCreateInCategory` — sin daño.
 */
export async function setLibraryCategoryDesignatedContributorsAction(
  input: unknown,
): Promise<SetLibraryCategoryDesignatedContributorsResult> {
  const parsed = setLibraryCategoryDesignatedContributorsInputSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationError('Datos inválidos para configurar contribuidores.', {
      issues: parsed.error.issues,
    })
  }
  const data = parsed.data

  const category = await prisma.libraryCategory.findUnique({
    where: { id: data.categoryId },
    select: { id: true, placeId: true, slug: true, archivedAt: true },
  })
  if (!category) {
    throw new NotFoundError('Categoría no encontrada.', { categoryId: data.categoryId })
  }
  if (category.archivedAt) {
    throw new NotFoundError('Categoría archivada.', { categoryId: data.categoryId })
  }

  const actor = await resolveActorForPlace({ placeId: category.placeId })
  const allowed = await hasPermission(actor.actorId, actor.placeId, 'library:moderate-categories', {
    categoryId: category.id,
  })
  if (!allowed) {
    throw new AuthorizationError(
      'No tenés permiso para configurar contribuidores en esta categoría.',
      {
        placeId: actor.placeId,
        categoryId: category.id,
        actorId: actor.actorId,
      },
    )
  }

  // Dedupe antes de validar.
  const uniqueUserIds = Array.from(new Set(data.userIds))

  if (uniqueUserIds.length > 0) {
    const found = await prisma.membership.findMany({
      where: {
        placeId: category.placeId,
        userId: { in: uniqueUserIds },
        leftAt: null,
      },
      select: { userId: true },
    })
    if (found.length !== uniqueUserIds.length) {
      return { ok: false, error: 'member_not_in_place' }
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.libraryCategoryContributor.deleteMany({ where: { categoryId: category.id } })
    if (uniqueUserIds.length > 0) {
      await tx.libraryCategoryContributor.createMany({
        data: uniqueUserIds.map((userId) => ({
          categoryId: category.id,
          userId,
          invitedByUserId: actor.actorId,
        })),
        skipDuplicates: true,
      })
    }
  })

  logger.info(
    {
      event: 'libraryCategoryDesignatedContributorsUpdated',
      placeId: category.placeId,
      categoryId: category.id,
      contributorCount: uniqueUserIds.length,
      actorId: actor.actorId,
    },
    'library category designated contributors updated',
  )

  revalidateLibraryCategoryPaths(actor.placeSlug, category.slug)
  return { ok: true }
}
