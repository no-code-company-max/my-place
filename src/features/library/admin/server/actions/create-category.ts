'use server'

import { prisma } from '@/db/client'
import { AuthorizationError, ValidationError } from '@/shared/errors/domain-error'
import { logger } from '@/shared/lib/logger'
import { resolveActorForPlace } from '@/features/discussions/public.server'
import { hasPermission } from '@/features/members/public.server'
import {
  RESERVED_LIBRARY_CATEGORY_SLUGS,
  generateLibraryCategorySlug,
} from '@/features/library/domain/slug'
import {
  assertCategoryCapacity,
  validateCategoryEmoji,
  validateCategorySlug,
  validateCategoryTitle,
} from '@/features/library/domain/invariants'
import { createCategoryInputSchema } from '@/features/library/schemas'
import { revalidateLibraryCategoryPaths } from '@/features/library/public.server'
import { acquireCategorySetLock } from './_with-category-set-lock'

/**
 * Crea una nueva categoría de biblioteca.
 *
 * Flow:
 *  1. Parse Zod del input.
 *  2. Resuelve el actor (membership activa) — tira `AuthorizationError`
 *     si no hay sesión / no es miembro.
 *  3. Gate de admin/owner: las categorías son decisión del admin.
 *  4. Cap: máximo 30 categorías activas por place.
 *  5. Invariants del dominio (defensa en profundidad sobre Zod).
 *  6. Resuelve slug único combinando RESERVED + slugs existentes en
 *     este place.
 *  7. INSERT atómico.
 *  8. Revalida `/library` + `/settings/library`.
 *
 * Toda la operación corre dentro de un `prisma.$transaction` con
 * `acquireCategorySetLock` al inicio para serializar contra otras
 * mutaciones del set (archive / reorder) en el mismo place. Sin el
 * lock, un reorder en curso podría leer el set sin esta categoría
 * y dejarla con `position` default fuera del orden intencional
 * (TOCTOU race a nivel app, RLS no protege porque ambos admins están
 * autorizados). Si el slug colisiona pese al resolver (race menor),
 * Prisma lanza P2002 y el caller ve `ConflictError` indirecto.
 *
 * Ver `docs/features/library/spec.md` § 14.2.
 */
export async function createLibraryCategoryAction(
  input: unknown,
): Promise<{ ok: true; categoryId: string; slug: string }> {
  const parsed = createCategoryInputSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationError('Datos inválidos para crear categoría.', {
      issues: parsed.error.issues,
    })
  }
  const data = parsed.data

  const actor = await resolveActorForPlace({ placeId: data.placeId })
  // G.3: gate atómico permission-groups. Crear categoría es global
  // (no scopable por categoría — la categoría aún no existe).
  const allowed = await hasPermission(actor.actorId, actor.placeId, 'library:moderate-categories')
  if (!allowed) {
    throw new AuthorizationError('No tenés permiso para crear categorías.', {
      placeId: actor.placeId,
      actorId: actor.actorId,
    })
  }

  validateCategoryTitle(data.title)
  validateCategoryEmoji(data.emoji)

  const trimmedTitle = data.title.trim()

  // El conteo, el read de slugs existentes y el INSERT corren bajo
  // el advisory lock para que un reorder concurrente vea el nuevo
  // estado consistente o espere su commit.
  const created = await prisma.$transaction(async (tx) => {
    await acquireCategorySetLock(tx, actor.placeId)

    const currentCount = await tx.libraryCategory.count({
      where: { placeId: actor.placeId, archivedAt: null },
    })
    assertCategoryCapacity(currentCount)

    const existingSlugs = await tx.libraryCategory.findMany({
      where: { placeId: actor.placeId },
      select: { slug: true },
    })
    const reserved = new Set<string>([
      ...RESERVED_LIBRARY_CATEGORY_SLUGS,
      ...existingSlugs.map((c) => c.slug),
    ])
    const slug = generateLibraryCategorySlug(trimmedTitle, { reserved })
    validateCategorySlug(slug)

    return tx.libraryCategory.create({
      data: {
        placeId: actor.placeId,
        slug,
        emoji: data.emoji,
        title: trimmedTitle,
        contributionPolicy: data.contributionPolicy,
        // G.5+6.b (2026-05-04): persistir kind. Default GENERAL via Zod.
        kind: data.kind,
      },
      select: { id: true, slug: true },
    })
  })

  logger.info(
    {
      event: 'libraryCategoryCreated',
      placeId: actor.placeId,
      categoryId: created.id,
      slug: created.slug,
      contributionPolicy: data.contributionPolicy,
      actorId: actor.actorId,
    },
    'library category created',
  )

  revalidateLibraryCategoryPaths(actor.placeSlug, created.slug, actor.placeId)
  return { ok: true, categoryId: created.id, slug: created.slug }
}
