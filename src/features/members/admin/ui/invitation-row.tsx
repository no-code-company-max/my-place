'use client'

import { Send, X } from 'lucide-react'
import { RowActions } from '@/shared/ui/row-actions'
import type { PendingInvitation, InvitationDeliveryStatus } from '@/features/members/public'

type Props = {
  invitation: PendingInvitation
  onSelect: () => void
  onResend: () => void
  /** Si null, NO se muestra la action Cancelar (sin permission). */
  onRevoke: (() => void) | null
}

/**
 * Row de una invitación pendiente en `/settings/members` (tab Invitados).
 *
 * Mirror del `<MemberRow>`: button principal tappable + kebab como sibling.
 * Click row → abre `<InvitationDetailPanel>` con info completa + acciones.
 * Kebab ofrece atajos directos: Reenviar (no destructive) + Cancelar (destructive
 * con confirm dialog automático del `<RowActions>`).
 *
 * `onRevoke === null` ⇒ viewer sin permiso `members:revoke-invitation`. En ese
 * caso solo se muestra "Reenviar" en el kebab.
 *
 * Status chip canónico: neutral para PENDING/SENT, emerald para DELIVERED,
 * amber para BOUNCED/COMPLAINED/FAILED. Misma palette que el pending list
 * legacy — se unifica en S4 cleanup.
 */
export function InvitationRow({
  invitation,
  onSelect,
  onResend,
  onRevoke,
}: Props): React.ReactNode {
  const actions: Array<{
    icon: React.ReactNode
    label: string
    destructive?: boolean
    confirmTitle?: string
    confirmDescription?: string
    confirmActionLabel?: string
    onSelect: () => void
  }> = [
    {
      icon: <Send aria-hidden="true" className="h-4 w-4" />,
      label: 'Reenviar',
      onSelect: onResend,
    },
  ]
  if (onRevoke) {
    actions.push({
      icon: <X aria-hidden="true" className="h-4 w-4" />,
      label: 'Cancelar',
      destructive: true,
      confirmTitle: `¿Cancelar invitación a ${invitation.email}?`,
      confirmDescription:
        'La invitación queda invalidada. El email no podrá usar el link recibido. Si querés volver a invitar, mandá una nueva invitación.',
      confirmActionLabel: 'Sí, cancelar',
      onSelect: onRevoke,
    })
  }

  const expiresLabel = formatExpires(invitation.expiresAt)
  const meta = STATUS_META[invitation.deliveryStatus]

  return (
    <li className="flex min-h-[56px] items-center gap-2">
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3 text-left hover:bg-neutral-50"
        aria-label={`Ver detalle de la invitación para ${invitation.email}`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-neutral-900">{invitation.email}</p>
            <span
              className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${meta.className}`}
              title={meta.help}
            >
              {meta.label}
            </span>
            {invitation.asOwner ? (
              <span className="shrink-0 rounded-full border border-amber-300 px-2 py-0.5 text-[11px] text-amber-700">
                owner
              </span>
            ) : invitation.asAdmin ? (
              <span className="shrink-0 rounded-full border border-neutral-300 px-2 py-0.5 text-[11px] text-neutral-600">
                admin
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-xs text-neutral-500">
            Invitado por {invitation.inviter.displayName}
            <span aria-hidden className="mx-1.5">
              ·
            </span>
            <span>vence {expiresLabel}</span>
          </p>
        </div>
      </button>
      <div className="shrink-0 pr-2">
        <RowActions
          triggerLabel={`Acciones para la invitación a ${invitation.email}`}
          chipClassName="hidden"
          forceOverflow={true}
          actions={actions}
        >
          <span aria-hidden />
        </RowActions>
      </div>
    </li>
  )
}

const STATUS_META: Record<
  InvitationDeliveryStatus,
  { label: string; className: string; help: string }
> = {
  PENDING: {
    label: 'pendiente',
    className: 'border-neutral-300 text-neutral-600',
    help: 'Esperando envío.',
  },
  SENT: {
    label: 'enviado',
    className: 'border-neutral-300 text-neutral-700',
    help: 'Email entregado al proveedor.',
  },
  DELIVERED: {
    label: 'entregado',
    className: 'border-emerald-300 text-emerald-700',
    help: 'El proveedor confirmó entrega.',
  },
  BOUNCED: {
    label: 'rebotado',
    className: 'border-amber-300 text-amber-700',
    help: 'El servidor del destinatario rechazó el email.',
  },
  COMPLAINED: {
    label: 'spam',
    className: 'border-amber-300 text-amber-700',
    help: 'El destinatario marcó como spam.',
  },
  FAILED: {
    label: 'falló',
    className: 'border-amber-300 text-amber-700',
    help: 'No se pudo enviar. Reenviá para reintentar.',
  },
}

function formatExpires(d: Date): string {
  return new Intl.DateTimeFormat('es-AR', {
    day: 'numeric',
    month: 'short',
  }).format(d)
}
