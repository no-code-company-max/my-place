import 'server-only'
import { Prisma } from '@prisma/client'

/**
 * Lock advisory transaccional sobre el "set de categorías" de un place.
 *
 * Las actions que modifican el conjunto de `LibraryCategory` activas
 * (create-category, archive-category, reorder-categories) deben llamar este
 * helper dentro de su `prisma.$transaction(async tx => …)` para serializar
 * entre sí dentro del mismo place.
 *
 * **Por qué**: sin lock, el reorder lee `findMany({archivedAt: null})` en una
 * conexión y los `UPDATE position` corren en otra. Si otro admin crea o
 * archiva una categoría entre el read y los writes, el set cambia bajo los
 * pies del reorder → la nueva categoría queda con `position` default (0 o
 * último) fuera del orden intencional (TOCTOU race). RLS no protege porque
 * ambos admins están autorizados — es una race a nivel de aplicación.
 *
 * **Cómo**: `pg_advisory_xact_lock(ns, key)` toma un lock advisory
 * transaccional. El namespace `LIBRARY_CATEGORY_SET_LOCK_NAMESPACE` es una
 * constante arbitraria que evita colisiones con otros advisory locks del
 * proyecto (ver `members/server/erasure/run-erasure.ts:38` que usa la single-
 * int variant `36524`). El segundo arg es `hashtext(placeId)` para que
 * places distintos no se bloqueen mutuamente.
 *
 * **Cleanup**: `pg_advisory_xact_lock` se libera automáticamente al
 * commit/rollback de la TX. NO requiere `pg_advisory_unlock` explícito.
 *
 * **Importante**: este helper NO debe usarse fuera de una `$transaction`.
 * Llamarlo sobre el cliente Prisma singleton crea un lock que nunca se
 * libera (no hay tx que cierre) — leak severo.
 *
 * Ver `docs/plans/2026-05-01-audit-checklist.md` § Bug #2.
 */
const LIBRARY_CATEGORY_SET_LOCK_NAMESPACE = 1

export async function acquireCategorySetLock(
  tx: Prisma.TransactionClient,
  placeId: string,
): Promise<void> {
  await tx.$executeRaw(
    Prisma.sql`SELECT pg_advisory_xact_lock(${LIBRARY_CATEGORY_SET_LOCK_NAMESPACE}, hashtext(${placeId}))`,
  )
}
