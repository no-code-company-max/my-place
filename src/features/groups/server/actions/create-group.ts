'use server'

import { Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/db/client'
import { requireAuthUserId } from '@/shared/lib/auth-user'
import { findPlaceOwnership } from '@/shared/lib/identity-cache'
import { loadPlaceBySlug } from '@/shared/lib/place-loader'
import { logger } from '@/shared/lib/logger'
import { AuthorizationError, NotFoundError, ValidationError } from '@/shared/errors/domain-error'
import { arePermissionsValid, normalizePermissions } from '@/features/groups/domain/invariants'
import { createGroupInputSchema } from '@/features/groups/schemas'

/**
 * Resultado de `createGroupAction` — discriminated union.
 *
 * Errores **esperados** del flujo viajan acá (gotcha CLAUDE.md 2026-05-02:
 * Next 15 NO preserva `code`/`context` en throws desde Server Actions).
 *
 * - `group_name_taken`: ya existe un grupo con ese nombre (case-insensitive)
 *   en el place. Caso típico cuando el owner dispara dos creates rápido.
 * - `permission_invalid`: el array `permissions` contiene algún string que
 *   no está en el enum hardcoded `Permission`. Defense in depth contra
 *   payloads manipulados — Zod ya valida en happy path.
 *
 * Errores **inesperados** (auth fail, place archivado, validación Zod
 * corrupta) siguen como throw → caen al `error.tsx` boundary.
 */
export type CreateGroupResult =
  | { ok: true; groupId: string }
  | { ok: false; error: 'group_name_taken' | 'permission_invalid' }

/**
 * Crea un grupo de permisos custom en un place. Owner-only (decisión #4
 * ADR — CRUD de grupos NO es delegable).
 *
 * Flow:
 *  1. Parse Zod del input.
 *  2. Auth: `requireAuthUserId`.
 *  3. Resuelve place por slug — `NotFoundError` si no existe o archivado.
 *  4. Owner gate: `findPlaceOwnership` directo (NO `hasPermission`).
 *  5. Valida permissions contra el enum hardcoded → discriminated union si
 *     hay valores inválidos (defense post-Zod).
 *  6. Pre-check de unicidad case-insensitive del name → discriminated union
 *     si hay match. Race con un INSERT concurrente queda cubierto por
 *     P2002 (catch al INSERT).
 *  7. INSERT del grupo + entries opcionales en `GroupCategoryScope` en una
 *     transacción.
 *  8. Log + revalida `/${placeSlug}/settings/groups`.
 */
export async function createGroupAction(input: unknown): Promise<CreateGroupResult> {
  const parsed = createGroupInputSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationError('Datos inválidos para crear grupo.', {
      issues: parsed.error.issues,
    })
  }
  const data = parsed.data

  const actorId = await requireAuthUserId('Necesitás iniciar sesión para crear grupos.')

  const place = await loadPlaceBySlug(data.placeSlug)
  if (!place || place.archivedAt) {
    throw new NotFoundError('Place no encontrado.', { placeSlug: data.placeSlug })
  }

  const isOwner = await findPlaceOwnership(actorId, place.id)
  if (!isOwner) {
    throw new AuthorizationError('Solo el owner puede crear grupos.', {
      placeId: place.id,
      actorId,
    })
  }

  if (!arePermissionsValid(data.permissions)) {
    return { ok: false, error: 'permission_invalid' }
  }
  const permissions = normalizePermissions(data.permissions)

  // Pre-check de name unique. Case-insensitive — alineado con el patrón
  // de `tier name dedup` (app-level). Race cubierto por catch P2002 abajo
  // si en el futuro se suma índice unique.
  const collision = await prisma.permissionGroup.findFirst({
    where: {
      placeId: place.id,
      name: { equals: data.name, mode: 'insensitive' },
    },
    select: { id: true },
  })
  if (collision) {
    return { ok: false, error: 'group_name_taken' }
  }

  try {
    const created = await prisma.permissionGroup.create({
      data: {
        placeId: place.id,
        name: data.name,
        description: data.description ?? null,
        permissions,
        isPreset: false,
        ...(data.categoryScopeIds && data.categoryScopeIds.length > 0
          ? {
              categoryScopes: {
                create: data.categoryScopeIds.map((categoryId) => ({ categoryId })),
              },
            }
          : {}),
      },
      select: { id: true },
    })

    logger.info(
      {
        event: 'permissionGroupCreated',
        placeId: place.id,
        groupId: created.id,
        permissionsCount: permissions.length,
        scopeCount: data.categoryScopeIds?.length ?? 0,
        actorId,
      },
      'permission group created',
    )

    revalidatePath(`/${place.slug}/settings/groups`)
    return { ok: true, groupId: created.id }
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      // Sin unique índice declarado hoy, este branch sólo dispara si se
      // agrega en el futuro. Lo dejamos defensivo.
      return { ok: false, error: 'group_name_taken' }
    }
    throw err
  }
}
