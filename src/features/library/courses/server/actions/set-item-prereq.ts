'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/db/client'
import { AuthorizationError, NotFoundError, ValidationError } from '@/shared/errors/domain-error'
import { logger } from '@/shared/lib/logger'
import { resolveActorForPlace } from '@/features/discussions/public.server'
import { hasPermission } from '@/features/members/public.server'
import { setItemPrereqInputSchema } from '@/features/library/courses/schemas'
import {
  validateNoCycle,
  type ItemForCycleCheck,
} from '@/features/library/courses/domain/prereq-validation'

/**
 * Resultado de `setItemPrereqAction` — discriminated union.
 *
 * Errores **esperados** del flujo van por discriminated union (Next 15
 * pierde props custom de Errors tirados desde Server Actions; ver gotcha
 * CLAUDE.md). Errores no esperados (auth fail, item no encontrado) sí
 * tiran porque indican misuse.
 *
 * - `category_not_course`: la categoría del item no es kind=COURSE — no
 *   se setean prereqs en GENERAL (D1 ADR `2026-05-04`).
 * - `prereq_not_in_category`: el `prereqItemId` no existe O pertenece a
 *   otra categoría. Defense in depth (form sólo lista items de la misma
 *   categoría, pero el server re-valida).
 * - `cycle_detected`: la asignación formaría un ciclo en la cadena de
 *   prereqs. Validación BFS app-layer (D4 ADR), max depth 50.
 */
export type SetItemPrereqResult =
  | { ok: true }
  | {
      ok: false
      error: 'category_not_course' | 'prereq_not_in_category' | 'cycle_detected'
    }

/**
 * Setea (o limpia, si `prereqItemId === null`) el prereq de un item de
 * biblioteca en categoría kind=COURSE.
 *
 * Permisos:
 *  - `library:moderate-categories` con scope a la categoría OR
 *  - actor es author del item (Post.authorUserId === actor).
 *
 * Owner siempre tiene `moderate-categories` por bypass (`hasPermission`).
 *
 * Flow:
 *  1. Parse Zod.
 *  2. Load item + category + actor.
 *  3. Permission gate (moderate ∨ author).
 *  4. Validar categoría kind === 'COURSE'.
 *  5. Si prereqItemId !== null: validar prereq existe + misma categoría
 *     + no-ciclo (BFS app-layer).
 *  6. UPDATE LibraryItem.prereqItemId.
 *  7. Revalidate.
 */
export async function setItemPrereqAction(input: unknown): Promise<SetItemPrereqResult> {
  const parsed = setItemPrereqInputSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationError('Datos inválidos para asignar prereq.', {
      issues: parsed.error.issues,
    })
  }
  const data = parsed.data

  const item = await prisma.libraryItem.findUnique({
    where: { id: data.itemId },
    select: {
      id: true,
      placeId: true,
      categoryId: true,
      authorUserId: true,
      archivedAt: true,
      prereqItemId: true,
      category: { select: { slug: true } },
      post: { select: { slug: true } },
    },
  })
  if (!item) {
    throw new NotFoundError('Item no encontrado.', { itemId: data.itemId })
  }

  const category = await prisma.libraryCategory.findUnique({
    where: { id: item.categoryId },
    select: { id: true, placeId: true, slug: true, kind: true, archivedAt: true },
  })
  if (!category) {
    throw new NotFoundError('Categoría no encontrada.', { categoryId: item.categoryId })
  }

  const actor = await resolveActorForPlace({ placeId: item.placeId })

  // Permission gate: moderador con scope a la categoría OR author del item.
  const canModerate = await hasPermission(
    actor.actorId,
    actor.placeId,
    'library:moderate-categories',
    { categoryId: category.id },
  )
  const isAuthor = item.authorUserId === actor.actorId
  if (!canModerate && !isAuthor) {
    throw new AuthorizationError('No tenés permiso para asignar prereqs en este item.', {
      placeId: actor.placeId,
      itemId: item.id,
      actorId: actor.actorId,
    })
  }

  // La categoría debe ser COURSE — no se setean prereqs en GENERAL.
  if (category.kind !== 'COURSE') {
    return { ok: false, error: 'category_not_course' }
  }

  // Si vamos a SETEAR un prereq (no limpiarlo), validar pertenencia + no-ciclo.
  if (data.prereqItemId !== null) {
    // Autoreferencia: el item no puede ser su propio prereq. Caza el caso
    // antes de hacer el lookup (que devolvería el mismo registro y
    // pasaría el "misma categoría" check). validateNoCycle también lo
    // detecta, pero acá es semánticamente más claro como cycle_detected.
    if (data.prereqItemId === item.id) {
      return { ok: false, error: 'cycle_detected' }
    }

    const prereq = await prisma.libraryItem.findUnique({
      where: { id: data.prereqItemId },
      select: { id: true, categoryId: true, archivedAt: true },
    })
    if (!prereq || prereq.categoryId !== category.id) {
      return { ok: false, error: 'prereq_not_in_category' }
    }

    // Cycle check: cargamos todos los items de la categoría con su
    // prereqItemId actual y construimos el lookup. La cadena viva en una
    // sola categoría hace que N esté acotado al N de items de la categoría
    // (típico < 50 — un curso con 50 lessons ya es enorme para Place).
    const allItems = await prisma.libraryItem.findMany({
      where: { categoryId: category.id },
      select: { id: true, prereqItemId: true },
    })
    const lookup = new Map<string, ItemForCycleCheck>(
      allItems.map((i) => [i.id, { prereqItemId: i.prereqItemId }]),
    )
    if (!validateNoCycle(item.id, data.prereqItemId, lookup)) {
      return { ok: false, error: 'cycle_detected' }
    }
  }

  await prisma.libraryItem.update({
    where: { id: item.id },
    data: { prereqItemId: data.prereqItemId },
  })

  logger.info(
    {
      event: 'libraryItemPrereqUpdated',
      placeId: actor.placeId,
      itemId: item.id,
      categoryId: category.id,
      prereqItemId: data.prereqItemId,
      actorId: actor.actorId,
    },
    'library item prereq updated',
  )

  // Revalidate paths del listado de la categoría + landing library
  // (counts/recientes). El detalle del item lo invalida la próxima
  // navegación al postSlug.
  revalidatePath(`/${actor.placeSlug}/library`)
  revalidatePath(`/${actor.placeSlug}/library/${category.slug}`)
  return { ok: true }
}
