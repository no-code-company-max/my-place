import 'server-only'
import type { Prisma } from '@prisma/client'

/**
 * Helper transaccional para cancelar un evento desde otro slice
 * (ej: flag review). Idempotente: si el evento ya está cancelado,
 * el UPDATE es no-op (filtra `cancelledAt: null`). El caller es
 * responsable del permission check + revalidate paths + log.
 *
 * Distinto de `cancelEventAction` (Server Action top-level con
 * permisos + revalidate + log). Acá sólo la mutación SQL.
 *
 * Ver `docs/features/flags/spec.md` § 6 (CANCEL_EVENT sideEffect).
 */
export async function cancelEventInTx(
  tx: Prisma.TransactionClient,
  eventId: string,
  now: Date = new Date(),
): Promise<{ alreadyCancelled: boolean }> {
  const result = await tx.event.updateMany({
    where: { id: eventId, cancelledAt: null },
    data: { cancelledAt: now },
  })
  return { alreadyCancelled: result.count === 0 }
}
