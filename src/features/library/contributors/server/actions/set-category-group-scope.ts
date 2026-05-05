'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/db/client'
import { requireAuthUserId } from '@/shared/lib/auth-user'
import { findPlaceOwnership } from '@/shared/lib/identity-cache'
import { logger } from '@/shared/lib/logger'
import { AuthorizationError, NotFoundError, ValidationError } from '@/shared/errors/domain-error'
import { setLibraryCategoryGroupScopeInputSchema } from '@/features/library/schemas'

/**
 * Resultado de `setLibraryCategoryGroupScopeAction` — discriminated union.
 *
 * - `group_not_in_place`: alguno de los `groupIds` pasados no pertenece al
 *   place de la categoría. Defense in depth contra payloads manipulados.
 *
 * No bloqueamos el preset "Administradores" (a diferencia del action
 * análogo de `groups/setGroupCategoryScopeAction`): el preset es un grupo
 * elegible más para SELECTED_GROUPS desde la perspectiva category-centric
 * (decisión #B ADR `2026-05-04-library-contribution-policy-groups.md`).
 */
export type SetLibraryCategoryGroupScopeResult =
  | { ok: true }
  | { ok: false; error: 'group_not_in_place' }

/**
 * Setea (override completo) la lista de `PermissionGroup` con scope a una
 * categoría library. Owner-only.
 *
 * Pasar `groupIds: []` deja la categoría sin grupos asignados (default
 * cerrado: ningún no-owner puede contribuir aunque policy=SELECTED_GROUPS).
 *
 * Flow:
 *  1. Parse Zod.
 *  2. Auth + load category + load place + owner gate.
 *  3. Si hay groupIds, valida que TODOS pertenezcan al mismo place →
 *     `group_not_in_place` si alguno está fuera.
 *  4. Tx: deleteMany scope existente + createMany del nuevo set.
 *
 * NO valida `category.contributionPolicy === 'SELECTED_GROUPS'` por dos
 * razones: (a) el owner puede preasignar grupos antes de cambiar la policy
 * y luego cambiarla en una sola UI flow; (b) si la policy es otra, las
 * filas en GroupCategoryScope existen pero no se evalúan en
 * `canCreateInCategory` — no hay daño.
 */
export async function setLibraryCategoryGroupScopeAction(
  input: unknown,
): Promise<SetLibraryCategoryGroupScopeResult> {
  const parsed = setLibraryCategoryGroupScopeInputSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationError('Datos inválidos para configurar scope de grupos.', {
      issues: parsed.error.issues,
    })
  }
  const data = parsed.data

  const actorId = await requireAuthUserId(
    'Necesitás iniciar sesión para configurar el scope de la categoría.',
  )

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

  const place = await prisma.place.findUnique({
    where: { id: category.placeId },
    select: { id: true, slug: true, archivedAt: true },
  })
  if (!place || place.archivedAt) {
    throw new NotFoundError('Place no encontrado.', { placeId: category.placeId })
  }

  const isOwner = await findPlaceOwnership(actorId, place.id)
  if (!isOwner) {
    throw new AuthorizationError('Solo el owner puede configurar el scope de grupos.', {
      placeId: place.id,
      categoryId: category.id,
      actorId,
    })
  }

  // Dedupe de los IDs antes de validar.
  const uniqueGroupIds = Array.from(new Set(data.groupIds))

  if (uniqueGroupIds.length > 0) {
    const found = await prisma.permissionGroup.findMany({
      where: { id: { in: uniqueGroupIds }, placeId: place.id },
      select: { id: true },
    })
    if (found.length !== uniqueGroupIds.length) {
      return { ok: false, error: 'group_not_in_place' }
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.groupCategoryScope.deleteMany({ where: { categoryId: category.id } })
    if (uniqueGroupIds.length > 0) {
      await tx.groupCategoryScope.createMany({
        data: uniqueGroupIds.map((groupId) => ({
          groupId,
          categoryId: category.id,
        })),
        skipDuplicates: true,
      })
    }
  })

  logger.info(
    {
      event: 'libraryCategoryGroupScopeUpdated',
      placeId: place.id,
      categoryId: category.id,
      scopeCount: uniqueGroupIds.length,
      actorId,
    },
    'library category group scope updated',
  )

  revalidatePath(`/${place.slug}/settings/library`)
  revalidatePath(`/${place.slug}/library`)
  revalidatePath(`/${place.slug}/library/${category.slug}`)
  return { ok: true }
}
