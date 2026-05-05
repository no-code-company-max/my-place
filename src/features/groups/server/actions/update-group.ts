'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/db/client'
import { requireAuthUserId } from '@/shared/lib/auth-user'
import { findPlaceOwnership } from '@/shared/lib/identity-cache'
import { loadPlaceById } from '@/shared/lib/place-loader'
import { logger } from '@/shared/lib/logger'
import { AuthorizationError, NotFoundError, ValidationError } from '@/shared/errors/domain-error'
import { arePermissionsValid, normalizePermissions } from '@/features/groups/domain/invariants'
import { isAdminPreset } from '@/features/groups/domain/presets'
import { updateGroupInputSchema } from '@/features/groups/schemas'

/**
 * Resultado de `updateGroupAction` — discriminated union.
 *
 * - `group_name_taken`: el nuevo nombre colisiona con otro grupo del place
 *   (case-insensitive).
 * - `permission_invalid`: el array `permissions` contiene strings que no
 *   están en el enum hardcoded.
 * - `cannot_modify_preset`: el grupo es el preset "Administradores" y se
 *   intentó cambiar `permissions` o `categoryScopeIds`. Se permite cambiar
 *   `name` y `description` del preset.
 */
export type UpdateGroupResult =
  | { ok: true }
  | {
      ok: false
      error: 'group_name_taken' | 'permission_invalid' | 'cannot_modify_preset'
    }

function arraysEqualAsSet<T>(a: ReadonlyArray<T>, b: ReadonlyArray<T>): boolean {
  if (a.length !== b.length) return false
  const setA = new Set(a)
  for (const item of b) if (!setA.has(item)) return false
  return true
}

/**
 * Edita un grupo. Owner-only.
 *
 * Reglas del preset hardcoded ("Administradores"):
 *  - Permite cambiar `name` y `description` (decisión: el owner puede
 *    preferir "Equipo de moderación" u otro label).
 *  - NO permite cambiar `permissions` ni `categoryScopeIds` →
 *    `cannot_modify_preset`.
 *
 * Flow:
 *  1. Parse Zod.
 *  2. Auth + load grupo + load place + owner gate.
 *  3. Si preset y se intenta cambiar permissions o categoryScopeIds →
 *     `cannot_modify_preset`.
 *  4. Valida permissions enum.
 *  5. Pre-check name unique (excluye el propio grupo del WHERE).
 *  6. UPDATE + sync de `categoryScopes` (delete + create) en tx para
 *     evitar estado intermedio inconsistente.
 */
export async function updateGroupAction(input: unknown): Promise<UpdateGroupResult> {
  const parsed = updateGroupInputSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationError('Datos inválidos para editar grupo.', {
      issues: parsed.error.issues,
    })
  }
  const data = parsed.data

  const actorId = await requireAuthUserId('Necesitás iniciar sesión para editar grupos.')

  const group = await prisma.permissionGroup.findUnique({
    where: { id: data.groupId },
    select: {
      id: true,
      placeId: true,
      name: true,
      isPreset: true,
      permissions: true,
      categoryScopes: { select: { categoryId: true } },
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
    throw new AuthorizationError('Solo el owner puede editar grupos.', {
      placeId: place.id,
      groupId: group.id,
      actorId,
    })
  }

  // Preset hardcoded: bloquear cambios a permissions y scope.
  if (isAdminPreset({ isPreset: group.isPreset, name: group.name })) {
    const requestedPermissions = normalizePermissions(data.permissions)
    const currentPermissions = group.permissions
    const requestedScope = data.categoryScopeIds ?? []
    const currentScope = group.categoryScopes.map((s) => s.categoryId)
    const permissionsChanged = !arraysEqualAsSet(currentPermissions, requestedPermissions)
    const scopeChanged = !arraysEqualAsSet(currentScope, requestedScope)
    if (permissionsChanged || scopeChanged) {
      return { ok: false, error: 'cannot_modify_preset' }
    }
  }

  if (!arePermissionsValid(data.permissions)) {
    return { ok: false, error: 'permission_invalid' }
  }
  const permissions = normalizePermissions(data.permissions)

  const collision = await prisma.permissionGroup.findFirst({
    where: {
      placeId: place.id,
      id: { not: group.id },
      name: { equals: data.name, mode: 'insensitive' },
    },
    select: { id: true },
  })
  if (collision) {
    return { ok: false, error: 'group_name_taken' }
  }

  await prisma.$transaction(async (tx) => {
    await tx.permissionGroup.update({
      where: { id: group.id },
      data: {
        name: data.name,
        description: data.description ?? null,
        permissions,
      },
    })
    // Sync de scope: simple delete + create. El `groupId, categoryId` está
    // en pk compuesta; un UPSERT por entry queda más complejo y para los
    // ~5-10 categories esperados es bottleneck inexistente.
    await tx.groupCategoryScope.deleteMany({ where: { groupId: group.id } })
    if (data.categoryScopeIds && data.categoryScopeIds.length > 0) {
      await tx.groupCategoryScope.createMany({
        data: data.categoryScopeIds.map((categoryId) => ({
          groupId: group.id,
          categoryId,
        })),
        skipDuplicates: true,
      })
    }
  })

  logger.info(
    {
      event: 'permissionGroupUpdated',
      placeId: place.id,
      groupId: group.id,
      permissionsCount: permissions.length,
      scopeCount: data.categoryScopeIds?.length ?? 0,
      actorId,
    },
    'permission group updated',
  )

  revalidatePath(`/${place.slug}/settings/groups`)
  revalidatePath(`/${place.slug}/settings/groups/${group.id}`)
  return { ok: true }
}
