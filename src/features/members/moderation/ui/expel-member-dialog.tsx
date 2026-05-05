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
import { EXPEL_MEMBER_REASON_MAX_LENGTH } from '@/features/members/schemas'
import { expelMemberAction } from '@/features/members/moderation/public'

/**
 * Modal para expulsar a un miembro del place. Owner-only — el page padre
 * decide si renderear este componente (`if (!perms.isOwner) → no mostrar`).
 * Plan G.4 — PermissionGroups.
 *
 * Form: motivo required (max 500) + email de contacto (default = actor,
 * editable). Submit dispara `expelMemberAction`. Mismo patrón que
 * `<BlockMemberDialog>` pero acción NO reversible — el ex-miembro debe
 * ser re-invitado para volver al place.
 *
 * Anti-phishing UI hint: idéntico al de block.
 */

type Props = {
  placeId: string
  memberUserId: string
  memberDisplayName: string
  /** Email del actor — autocompleta el campo `contactEmail`. */
  actorEmail: string
  /** Render del trigger (botón "Expulsar miembro"). */
  trigger: React.ReactNode
}

export function ExpelMemberDialog({
  placeId,
  memberUserId,
  memberDisplayName,
  actorEmail,
  trigger,
}: Props): React.ReactNode {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [reason, setReason] = useState('')
  const [contactEmail, setContactEmail] = useState(actorEmail)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    startTransition(async () => {
      try {
        const result = await expelMemberAction({
          placeId,
          memberUserId,
          reason,
          contactEmail,
        })
        if (!result.ok) {
          toast.error(expelErrorLabel(result.error))
          return
        }
        toast.success(`${memberDisplayName} fue expulsado del place.`)
        setOpen(false)
        setReason('')
        setContactEmail(actorEmail)
      } catch (err) {
        toast.error(friendlyError(err))
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogTitle>Expulsar miembro</DialogTitle>
        <DialogDescription>
          {memberDisplayName} dejará de ser miembro del place. Esta acción no es reversible — para
          volver, deberás invitarlo nuevamente. Se le enviará un email con el motivo.
        </DialogDescription>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4" noValidate>
          <label className="block">
            <span className="mb-1 block text-sm text-muted">Motivo</span>
            <textarea
              required
              maxLength={EXPEL_MEMBER_REASON_MAX_LENGTH}
              rows={4}
              placeholder="Por qué estás expulsando a este miembro."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-md border border-border bg-bg px-3 py-2 text-text focus:border-text focus:outline-none"
            />
            <span className="mt-1 block text-xs text-muted">
              {reason.length}/{EXPEL_MEMBER_REASON_MAX_LENGTH}
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
              {pending ? 'Expulsando…' : 'Expulsar y enviar email'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function expelErrorLabel(
  error: 'cannot_expel_owner' | 'cannot_expel_self' | 'target_user_not_member',
): string {
  switch (error) {
    case 'cannot_expel_owner':
      return 'No podés expulsar a otro owner del place.'
    case 'cannot_expel_self':
      return 'No podés expulsarte a vos mismo.'
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
        return 'Solo el owner puede expulsar miembros.'
      case 'NOT_FOUND':
        return 'No encontramos el place.'
      default:
        return 'No se pudo expulsar al miembro.'
    }
  }
  return 'Error inesperado. Intentá de nuevo.'
}
