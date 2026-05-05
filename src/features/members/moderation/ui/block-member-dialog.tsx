'use client'

import { useState, useTransition } from 'react'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/shared/ui/dialog'
import { toast } from '@/shared/ui/toaster'
import { isDomainError } from '@/shared/errors/domain-error'
import {
  BLOCK_MEMBER_REASON_MAX_LENGTH,
  UNBLOCK_MEMBER_MESSAGE_MAX_LENGTH,
} from '@/features/members/schemas'
import { blockMemberAction, unblockMemberAction } from '@/features/members/moderation/public'

/**
 * Modal para bloquear o desbloquear un miembro. Plan G.4 — PermissionGroups.
 *
 * `mode='block'`: form con motivo (required, max 500) + email de contacto
 * (default = email del actor, editable). Submit dispara `blockMemberAction`.
 *
 * `mode='unblock'`: form con mensaje opcional + email de contacto (mismo
 * patrón). Submit dispara `unblockMemberAction`.
 *
 * Ambos modos comparten el mismo dialog para minimizar duplicación. La page
 * padre decide qué mode renderear según `Membership.blockedAt`.
 *
 * Anti-phishing UI hint (audit-fix): texto explicativo arriba del campo
 * `contactEmail` aclarando que se envía al miembro y que NO se debe usar
 * email ajeno.
 *
 * Patrón Dialog: `DialogTrigger asChild` envuelve el children del prop
 * `trigger` (gotcha M.6 evitar controlled state innecesario). El componente
 * controla `open` para poder cerrar tras submit success.
 */

type BlockMode = {
  kind: 'block'
  /** placeId requerido — el server action lo valida. */
  placeId: string
  memberUserId: string
  memberDisplayName: string
  /** Email del actor — autocompleta el campo `contactEmail`. */
  actorEmail: string
}

type UnblockMode = {
  kind: 'unblock'
  placeId: string
  memberUserId: string
  memberDisplayName: string
  actorEmail: string
}

type Props = {
  mode: BlockMode | UnblockMode
  /** Render del trigger (botón "Bloquear miembro" / "Desbloquear miembro"). */
  trigger: React.ReactNode
}

export function BlockMemberDialog({ mode, trigger }: Props): React.ReactNode {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [reason, setReason] = useState('')
  const [contactEmail, setContactEmail] = useState(mode.actorEmail)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    startTransition(async () => {
      try {
        if (mode.kind === 'block') {
          const result = await blockMemberAction({
            placeId: mode.placeId,
            memberUserId: mode.memberUserId,
            reason,
            contactEmail,
          })
          if (!result.ok) {
            toast.error(blockErrorLabel(result.error))
            return
          }
          toast.success(`${mode.memberDisplayName} fue bloqueado.`)
        } else {
          const result = await unblockMemberAction({
            placeId: mode.placeId,
            memberUserId: mode.memberUserId,
            message: reason.trim().length > 0 ? reason : undefined,
            contactEmail,
          })
          if (!result.ok) {
            toast.error(unblockErrorLabel(result.error))
            return
          }
          toast.success(`${mode.memberDisplayName} fue desbloqueado.`)
        }
        setOpen(false)
        setReason('')
        setContactEmail(mode.actorEmail)
      } catch (err) {
        toast.error(friendlyError(err))
      }
    })
  }

  const isBlock = mode.kind === 'block'
  const titleText = isBlock ? 'Bloquear miembro' : 'Desbloquear miembro'
  const descText = isBlock
    ? `${mode.memberDisplayName} no podrá acceder al place mientras esté bloqueado. Se le enviará un email con el motivo.`
    : `${mode.memberDisplayName} podrá volver a acceder al place. Se le enviará un email avisándole.`
  const reasonLabel = isBlock ? 'Motivo' : 'Mensaje (opcional)'
  const reasonPlaceholder = isBlock
    ? 'Por qué estás bloqueando a este miembro.'
    : 'Mensaje breve para el miembro (opcional).'
  const reasonMax = isBlock ? BLOCK_MEMBER_REASON_MAX_LENGTH : UNBLOCK_MEMBER_MESSAGE_MAX_LENGTH
  const reasonRequired = isBlock
  const submitText = pending
    ? isBlock
      ? 'Bloqueando…'
      : 'Desbloqueando…'
    : isBlock
      ? 'Bloquear y enviar email'
      : 'Desbloquear y enviar email'

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogTitle>{titleText}</DialogTitle>
        <DialogDescription>{descText}</DialogDescription>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4" noValidate>
          <label className="block">
            <span className="mb-1 block text-sm text-muted">{reasonLabel}</span>
            <textarea
              required={reasonRequired}
              maxLength={reasonMax}
              rows={4}
              placeholder={reasonPlaceholder}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-md border border-border bg-bg px-3 py-2 text-text focus:border-text focus:outline-none"
            />
            <span className="mt-1 block text-xs text-muted">
              {reason.length}/{reasonMax}
            </span>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-muted">Email de contacto</span>
            <input
              type="email"
              required
              maxLength={254}
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="w-full rounded-md border border-border bg-bg px-3 py-2 text-text focus:border-text focus:outline-none"
            />
            <span className="mt-1 block text-xs text-muted">
              Este email se enviará al miembro para que pueda contactarte. Por defecto usamos el
              email de tu cuenta — editalo SOLO si querés que te contacten en otra dirección. NO
              uses un email ajeno.
            </span>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <DialogClose asChild>
              <button
                type="button"
                disabled={pending}
                className="rounded-md px-3 py-2 text-sm text-muted hover:text-text"
              >
                Cancelar
              </button>
            </DialogClose>
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-accent px-4 py-2 text-sm text-bg disabled:opacity-60"
            >
              {submitText}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function blockErrorLabel(
  error: 'cannot_block_owner' | 'cannot_block_self' | 'already_blocked' | 'target_user_not_member',
): string {
  switch (error) {
    case 'cannot_block_owner':
      return 'No podés bloquear al owner del place.'
    case 'cannot_block_self':
      return 'No podés bloquearte a vos mismo.'
    case 'already_blocked':
      return 'Este miembro ya está bloqueado.'
    case 'target_user_not_member':
      return 'Este usuario ya no es miembro activo del place.'
  }
}

function unblockErrorLabel(error: 'not_blocked' | 'target_user_not_member'): string {
  switch (error) {
    case 'not_blocked':
      return 'Este miembro no está bloqueado.'
    case 'target_user_not_member':
      return 'Este usuario ya no es miembro activo del place.'
  }
}

function friendlyError(err: unknown): string {
  if (isDomainError(err)) {
    switch (err.code) {
      case 'VALIDATION':
        return err.message
      case 'AUTHORIZATION':
        return 'No tenés permiso para esta acción.'
      case 'NOT_FOUND':
        return 'No encontramos el place.'
      default:
        return 'No se pudo completar la acción.'
    }
  }
  return 'Error inesperado. Intentá de nuevo.'
}
