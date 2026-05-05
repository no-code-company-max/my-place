'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/db/client'
import { requireAuthUserId } from '@/shared/lib/auth-user'
import { findPlaceOwnership } from '@/shared/lib/identity-cache'
import { loadPlaceById } from '@/shared/lib/place-loader'
import { logger } from '@/shared/lib/logger'
import { AuthorizationError, NotFoundError, ValidationError } from '@/shared/errors/domain-error'
import { isAdminPreset } from '@/features/groups/domain/presets'
import { setGroupCategoryScopeInputSchema } from '@/features/groups/schemas'

/**
 * Resultado de `setGroupCategoryScopeAction` — discriminated union.
 *
 * - `category_not_in_place`: alguno de los `categoryIds` pasados no
 *   pertenece al place del grupo. Defense in depth contra payloads
 *   manipulados.
 * - `cannot_scope_preset`: el grupo es el preset hardcoded
 *   "Administradores". El preset siempre es global (decisión #3 ADR).
 */
export type SetGroupCategoryScopeResult =
  | { ok: true }
  | { ok: false; error: 'category_not_in_place' | 'cannot_scope_preset' }

/**
 * Setea el scope library de un grupo (override completo). Owner-only.
 *
 * Pasar `categoryIds: []` deja al grupo en scope global (sin entries).
 *
 * Flow:
 *  1. Parse Zod.
 *  2. Auth + load grupo + load place + owner gate.
 *  3. Si preset → `cannot_scope_preset`.
 *  4. Si hay categoryIds, valida que TODOS pertenezcan al place →
 *     `category_not_in_place` si alguno está fuera.
 *  5. Tx: deleteMany scope existente + createMany del nuevo set.
 */
export async function setGroupCategoryScopeAction(
  input: unknown,
): Promise<SetGroupCategoryScopeResult> {
  const parsed = setGroupCategoryScopeInputSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationError('Datos inválidos para configurar scope.', {
      issues: parsed.error.issues,
    })
  }
  const data = parsed.data

  const actorId = await requireAuthUserId('Necesitás iniciar sesión para configurar scope.')

  const group = await prisma.permissionGroup.findUnique({
    where: { id: data.groupId },
    select: { id: true, placeId: true, name: true, isPreset: true },
  })
  if (!group) {
    throw new NotFoundError('Grupo no encontrado.', { groupId: data.groupId })
  }

  const place = await loadPlaceById(group.placeId)
  if (!place || place.archivedAt) {
    throw new NotFoundError('Place no encontrado.', { placeId: group.placeId })
  }

  const isOwner = await findPlaceOwnership(actorId, place.id)
  if (!isOwner) {
    throw new AuthorizationError('Solo el owner puede configurar scope.', {
      placeId: place.id,
      groupId: group.id,
      actorId,
    })
  }

  if (isAdminPreset({ isPreset: group.isPreset, name: group.name })) {
    return { ok: false, error: 'cannot_scope_preset' }
  }

  // Dedupe de los IDs antes de validar.
  const uniqueCategoryIds = Array.from(new Set(data.categoryIds))

  if (uniqueCategoryIds.length > 0) {
    const found = await prisma.libraryCategory.findMany({
      where: { id: { in: uniqueCategoryIds }, placeId: place.id },
      select: { id: true },
    })
    if (found.length !== uniqueCategoryIds.length) {
      return { ok: false, error: 'category_not_in_place' }
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.groupCategoryScope.deleteMany({ where: { groupId: group.id } })
    if (uniqueCategoryIds.length > 0) {
      await tx.groupCategoryScope.createMany({
        data: uniqueCategoryIds.map((categoryId) => ({
          groupId: group.id,
          categoryId,
        })),
        skipDuplicates: true,
      })
    }
  })

  logger.info(
    {
      event: 'permissionGroupScopeUpdated',
      placeId: place.id,
      groupId: group.id,
      scopeCount: uniqueCategoryIds.length,
      actorId,
    },
    'permission group scope updated',
  )

  revalidatePath(`/${place.slug}/settings/groups`)
  revalidatePath(`/${place.slug}/settings/groups/${group.id}`)
  return { ok: true }
}
