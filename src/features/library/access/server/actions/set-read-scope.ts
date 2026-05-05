'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/db/client'
import { requireAuthUserId } from '@/shared/lib/auth-user'
import { findPlaceOwnership } from '@/shared/lib/identity-cache'
import { logger } from '@/shared/lib/logger'
import { AuthorizationError, NotFoundError, ValidationError } from '@/shared/errors/domain-error'
import { setLibraryCategoryReadScopeInputSchema } from '@/features/library/access/schemas'

/**
 * Resultado del action — discriminated union con motivos esperables.
 *
 * Convención del repo (ver CLAUDE.md § "Errores esperados en Server Actions"):
 * los motivos esperados del flujo retornan `{ ok: false }` para que el caller
 * los discrimine cliente-side. Errores no esperados (auth, NotFound,
 * ValidationError) siguen siendo throws → boundary `error.tsx`.
 *
 * - `group_not_in_place`: alguno de los `groupIds` no pertenece al place.
 * - `tier_not_in_place`: alguno de los `tierIds` no pertenece al place.
 * - `member_not_in_place`: alguno de los `userIds` no tiene membership
 *   activa al place de la categoría.
 */
export type SetLibraryCategoryReadScopeResult =
  | { ok: true }
  | {
      ok: false
      error: 'group_not_in_place' | 'tier_not_in_place' | 'member_not_in_place'
    }

/**
 * Setea (override completo) el read access scope de una categoría library.
 *
 * El input es un discriminated union por `kind` (PUBLIC | GROUPS | TIERS | USERS).
 * Owner-only (decisión #C ADR `2026-05-04-library-courses-and-read-access.md`:
 * sólo owner manipula read access — admin no, distinto de write/contribution).
 *
 * Flow:
 *  1. Parse Zod (discriminated union — payloads que mezclen kind con array
 *     incorrecto son rechazados acá).
 *  2. Auth + load category + load place + owner gate.
 *  3. Validar pertenencia del set al place (groups | tiers | userIds activos).
 *  4. Tx atómica: update `readAccessKind` + deleteMany de las 3 tablas (override
 *     completo) + createMany sólo en la tabla del kind elegido (si hay rows).
 *
 * El delete de las 3 tablas (no sólo de la "vieja") protege contra estados
 * inconsistentes: si el discriminator estaba en GROUPS y queda alguna row
 * en TIERS por bug previo, el override deja el sistema limpio.
 */
export async function setLibraryCategoryReadScopeAction(
  input: unknown,
): Promise<SetLibraryCategoryReadScopeResult> {
  const parsed = setLibraryCategoryReadScopeInputSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationError('Datos inválidos para configurar el acceso de lectura.', {
      issues: parsed.error.issues,
    })
  }
  const data = parsed.data

  const actorId = await requireAuthUserId(
    'Necesitás iniciar sesión para configurar el acceso de lectura.',
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
    throw new AuthorizationError('Solo el owner puede configurar el acceso de lectura.', {
      placeId: place.id,
      categoryId: category.id,
      actorId,
    })
  }

  // Validación específica por kind. Dedupe + check de pertenencia al place.
  // PUBLIC no necesita validación (no tiene set asociado).
  let groupIds: string[] = []
  let tierIds: string[] = []
  let userIds: string[] = []

  switch (data.kind) {
    case 'PUBLIC':
      // No hay set — sólo cambia el discriminator.
      break
    case 'GROUPS': {
      groupIds = Array.from(new Set(data.groupIds))
      if (groupIds.length > 0) {
        const found = await prisma.permissionGroup.findMany({
          where: { id: { in: groupIds }, placeId: place.id },
          select: { id: true },
        })
        if (found.length !== groupIds.length) {
          return { ok: false, error: 'group_not_in_place' }
        }
      }
      break
    }
    case 'TIERS': {
      tierIds = Array.from(new Set(data.tierIds))
      if (tierIds.length > 0) {
        const found = await prisma.tier.findMany({
          where: { id: { in: tierIds }, placeId: place.id },
          select: { id: true },
        })
        if (found.length !== tierIds.length) {
          return { ok: false, error: 'tier_not_in_place' }
        }
      }
      break
    }
    case 'USERS': {
      userIds = Array.from(new Set(data.userIds))
      if (userIds.length > 0) {
        const found = await prisma.membership.findMany({
          where: {
            placeId: place.id,
            userId: { in: userIds },
            leftAt: null,
          },
          select: { userId: true },
        })
        if (found.length !== userIds.length) {
          return { ok: false, error: 'member_not_in_place' }
        }
      }
      break
    }
  }

  await prisma.$transaction(async (tx) => {
    // Setea discriminator.
    await tx.libraryCategory.update({
      where: { id: category.id },
      data: { readAccessKind: data.kind },
    })
    // Override completo: limpia las 3 tablas (defensa contra estados huérfanos).
    await tx.libraryCategoryGroupReadScope.deleteMany({ where: { categoryId: category.id } })
    await tx.libraryCategoryTierReadScope.deleteMany({ where: { categoryId: category.id } })
    await tx.libraryCategoryUserReadScope.deleteMany({ where: { categoryId: category.id } })

    // Crea sólo en la tabla del kind elegido.
    if (groupIds.length > 0) {
      await tx.libraryCategoryGroupReadScope.createMany({
        data: groupIds.map((groupId) => ({ categoryId: category.id, groupId })),
        skipDuplicates: true,
      })
    }
    if (tierIds.length > 0) {
      await tx.libraryCategoryTierReadScope.createMany({
        data: tierIds.map((tierId) => ({ categoryId: category.id, tierId })),
        skipDuplicates: true,
      })
    }
    if (userIds.length > 0) {
      await tx.libraryCategoryUserReadScope.createMany({
        data: userIds.map((userId) => ({ categoryId: category.id, userId })),
        skipDuplicates: true,
      })
    }
  })

  logger.info(
    {
      event: 'libraryCategoryReadScopeUpdated',
      placeId: place.id,
      categoryId: category.id,
      kind: data.kind,
      scopeCount: groupIds.length + tierIds.length + userIds.length,
      actorId,
    },
    'library category read scope updated',
  )

  revalidatePath(`/${place.slug}/settings/library`)
  revalidatePath(`/${place.slug}/library`)
  revalidatePath(`/${place.slug}/library/${category.slug}`)
  return { ok: true }
}
