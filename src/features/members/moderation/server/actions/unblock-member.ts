'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/db/client'
import { requireAuthUserId } from '@/shared/lib/auth-user'
import { loadPlaceById } from '@/shared/lib/place-loader'
import { logger } from '@/shared/lib/logger'
import { AuthorizationError, NotFoundError, ValidationError } from '@/shared/errors/domain-error'
import { hasPermission } from '@/features/members/server/permissions'
import { unblockMemberInputSchema } from '@/features/members/schemas'
import { sendUnblockEmail } from '../mailer/unblock-email'

/**
 * Restaura el acceso de un miembro bloqueado. Permiso atómico
 * `members:block` (mismo permiso que bloquear — quien bloquea, desbloquea).
 * Plan G.4 — PermissionGroups.
 *
 * Pone `blockedAt = null`. **NO** limpia `blockedReason`, `blockedByUserId`
 * ni `blockedContactEmail`: quedan como histórico para audit futuro o
 * para que el actor pueda re-bloquear con el mismo motivo si reincide.
 *
 * Email Resend al miembro restaurado (cortesía — el miembro merece saber).
 * `message` opcional permite agregar un texto breve al template.
 *
 * Discriminated union para errores esperados — único caso `not_blocked`
 * (intentar desbloquear a alguien que no estaba bloqueado).
 *
 * Spec: docs/features/groups/spec.md § 12, § 14.
 */
export type UnblockMemberResult =
  | { ok: true }
  | { ok: false; error: 'not_blocked' | 'target_user_not_member' }

export async function unblockMemberAction(input: unknown): Promise<UnblockMemberResult> {
  const parsed = unblockMemberInputSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationError('Datos inválidos para desbloquear miembro.', {
      issues: parsed.error.issues,
    })
  }
  const { placeId, memberUserId, message, contactEmail } = parsed.data

  const actorId = await requireAuthUserId('Necesitás iniciar sesión para desbloquear miembros.')

  const place = await loadPlaceById(placeId)
  if (!place || place.archivedAt) {
    throw new NotFoundError('Place no encontrado.', { placeId })
  }

  const canUnblock = await hasPermission(actorId, place.id, 'members:block')
  if (!canUnblock) {
    throw new AuthorizationError('No tenés permiso para desbloquear miembros en este place.', {
      placeId: place.id,
      actorId,
    })
  }

  const targetMembership = await prisma.membership.findFirst({
    where: { userId: memberUserId, placeId: place.id, leftAt: null },
    select: { id: true, blockedAt: true, user: { select: { email: true } } },
  })
  if (!targetMembership) {
    return { ok: false, error: 'target_user_not_member' }
  }

  if (targetMembership.blockedAt === null) {
    return { ok: false, error: 'not_blocked' }
  }

  await prisma.membership.update({
    where: { id: targetMembership.id },
    data: {
      blockedAt: null,
      // blockedReason / blockedByUserId / blockedContactEmail SE MANTIENEN
      // como histórico (decisión #10 ADR PermissionGroups).
    },
  })

  logger.info(
    {
      event: 'memberUnblocked',
      placeId: place.id,
      memberUserId,
      actorId,
    },
    'member unblocked',
  )

  try {
    await sendUnblockEmail({
      to: targetMembership.user.email,
      placeName: place.name,
      message: message && message.length > 0 ? message : null,
      contactEmail,
    })
  } catch (err) {
    logger.warn(
      {
        event: 'memberUnblockedEmailFailed',
        placeId: place.id,
        memberUserId,
        actorId,
        err: err instanceof Error ? err.message : String(err),
      },
      'unblock notice email failed — unblock already committed',
    )
  }

  revalidatePath(`/${place.slug}/settings/members/${memberUserId}`)
  return { ok: true }
}
