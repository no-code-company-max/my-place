'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/db/client'
import { requireAuthUserId } from '@/shared/lib/auth-user'
import { findPlaceOwnership } from '@/shared/lib/identity-cache'
import { loadPlaceById } from '@/shared/lib/place-loader'
import { logger } from '@/shared/lib/logger'
import { AuthorizationError, NotFoundError, ValidationError } from '@/shared/errors/domain-error'
import { isAdminPreset } from '@/features/groups/domain/presets'
import { deleteGroupInputSchema } from '@/features/groups/schemas'

/**
 * Resultado de `deleteGroupAction` — discriminated union.
 *
 * - `group_has_members`: el grupo tiene 1+ `GroupMembership`. El owner debe
 *   quitar a los miembros antes de eliminar (decisión #6 ADR — pre-condición
 *   explícita evita orfandad accidental de permisos).
 * - `cannot_delete_preset`: el grupo es el preset hardcoded "Administradores".
 *   NO se puede eliminar nunca (decisión #3 ADR).
 */
export type DeleteGroupResult =
  | { ok: true }
  | { ok: false; error: 'group_has_members' | 'cannot_delete_preset' }

/**
 * Hard-delete de un grupo. Owner-only.
 *
 * Pre-condiciones:
 *  - NO puede ser el preset (`cannot_delete_preset`).
 *  - NO puede tener miembros (`group_has_members`).
 *
 * Cascada DB: el `onDelete: Cascade` de `GroupCategoryScope` y
 * `GroupMembership` limpian rows huérfanos. Para `GroupMembership` la
 * cascada NO se dispara porque pre-checkeamos `group_has_members` — pero
 * si en el futuro relajamos el check, la cascada cubre.
 */
export async function deleteGroupAction(input: unknown): Promise<DeleteGroupResult> {
  const parsed = deleteGroupInputSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationError('Datos inválidos para eliminar grupo.', {
      issues: parsed.error.issues,
    })
  }
  const data = parsed.data

  const actorId = await requireAuthUserId('Necesitás iniciar sesión para eliminar grupos.')

  const group = await prisma.permissionGroup.findUnique({
    where: { id: data.groupId },
    select: {
      id: true,
      placeId: true,
      name: true,
      isPreset: true,
      _count: { select: { groupMemberships: true } },
    },
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
    throw new AuthorizationError('Solo el owner puede eliminar grupos.', {
      placeId: place.id,
      groupId: group.id,
      actorId,
    })
  }

  if (isAdminPreset({ isPreset: group.isPreset, name: group.name })) {
    return { ok: false, error: 'cannot_delete_preset' }
  }

  if (group._count.groupMemberships > 0) {
    return { ok: false, error: 'group_has_members' }
  }

  await prisma.permissionGroup.delete({ where: { id: group.id } })

  logger.info(
    {
      event: 'permissionGroupDeleted',
      placeId: place.id,
      groupId: group.id,
      actorId,
    },
    'permission group deleted',
  )

  revalidatePath(`/${place.slug}/settings/groups`)
  return { ok: true }
}
