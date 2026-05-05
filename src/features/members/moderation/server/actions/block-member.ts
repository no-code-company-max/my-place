'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/db/client'
import { requireAuthUserId } from '@/shared/lib/auth-user'
import { findPlaceOwnership } from '@/shared/lib/identity-cache'
import { loadPlaceById } from '@/shared/lib/place-loader'
import { logger } from '@/shared/lib/logger'
import { AuthorizationError, NotFoundError, ValidationError } from '@/shared/errors/domain-error'
import { hasPermission } from '@/features/members/server/permissions'
import { blockMemberInputSchema } from '@/features/members/schemas'
import { sendBlockEmail } from '../mailer/block-email'

/**
 * Bloquea el acceso de un miembro al place. Permiso atómico `members:block`
 * (delegable a grupos custom). Plan G.4 — PermissionGroups.
 *
 * Soft-block: setea `Membership.blockedAt = now()` + metadata. La membership
 * persiste; el gate `(gated)/layout.tsx` rechaza el acceso renderizando
 * `<UserBlockedView>` con la razón + email de contacto del actor.
 *
 * Discriminated union para errores **esperados** (gotcha CLAUDE.md
 * 2026-05-02 + decisión #13 ADR PermissionGroups). Errores inesperados
 * (auth, place no encontrado, validación corrupta) siguen como throw.
 *
 * Email Resend: try/catch — si el send falla, el bloqueo SÍ se commitea
 * (decisión #9 ADR PermissionGroups). El warning va al logger; la UI
 * decide cómo mostrarle al actor que el email no se mandó.
 *
 * Spec: docs/features/groups/spec.md § 12, § 14.
 */
export type BlockMemberResult =
  | { ok: true }
  | {
      ok: false
      error:
        | 'cannot_block_owner'
        | 'cannot_block_self'
        | 'already_blocked'
        | 'target_user_not_member'
    }

export async function blockMemberAction(input: unknown): Promise<BlockMemberResult> {
  const parsed = blockMemberInputSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationError('Datos inválidos para bloquear miembro.', {
      issues: parsed.error.issues,
    })
  }
  const { placeId, memberUserId, reason, contactEmail } = parsed.data

  const actorId = await requireAuthUserId('Necesitás iniciar sesión para bloquear miembros.')

  const place = await loadPlaceById(placeId)
  if (!place || place.archivedAt) {
    throw new NotFoundError('Place no encontrado.', { placeId })
  }

  // Permiso atómico — chequeado vía hasPermission (owner-bypass + membership
  // al preset Administradores; sin fallback role post-cleanup C.3).
  const canBlock = await hasPermission(actorId, place.id, 'members:block')
  if (!canBlock) {
    throw new AuthorizationError('No tenés permiso para bloquear miembros en este place.', {
      placeId: place.id,
      actorId,
    })
  }

  // Self-block bloqueado: ningún admin debería poder bloquearse a sí mismo
  // accidentalmente (perdería acceso al place y posiblemente al settings).
  if (memberUserId === actorId) {
    return { ok: false, error: 'cannot_block_self' }
  }

  // Owner inviolable: incluso otros owners (co-ownership) no pueden bloquear
  // a un owner. La transferencia/expulsión de owners pasa por flows distintos.
  const isTargetOwner = await findPlaceOwnership(memberUserId, place.id)
  if (isTargetOwner) {
    return { ok: false, error: 'cannot_block_owner' }
  }

  const targetMembership = await prisma.membership.findFirst({
    where: { userId: memberUserId, placeId: place.id, leftAt: null },
    select: { id: true, blockedAt: true, user: { select: { email: true } } },
  })
  if (!targetMembership) {
    return { ok: false, error: 'target_user_not_member' }
  }

  if (targetMembership.blockedAt !== null) {
    return { ok: false, error: 'already_blocked' }
  }

  await prisma.membership.update({
    where: { id: targetMembership.id },
    data: {
      blockedAt: new Date(),
      blockedByUserId: actorId,
      blockedReason: reason,
      blockedContactEmail: contactEmail,
    },
  })

  logger.info(
    {
      event: 'memberBlocked',
      placeId: place.id,
      memberUserId,
      actorId,
    },
    'member blocked',
  )

  // Email Resend: try/catch — si falla, el bloqueo ya se commiteó. Logueamos
  // warning para que el operator pueda investigar; la action retorna ok:true
  // igual (la intención principal — bloquear — se ejecutó).
  try {
    await sendBlockEmail({
      to: targetMembership.user.email,
      placeName: place.name,
      reason,
      contactEmail,
    })
  } catch (err) {
    logger.warn(
      {
        event: 'memberBlockedEmailFailed',
        placeId: place.id,
        memberUserId,
        actorId,
        err: err instanceof Error ? err.message : String(err),
      },
      'block notice email failed — block already committed',
    )
  }

  revalidatePath(`/${place.slug}/settings/members/${memberUserId}`)
  return { ok: true }
}
