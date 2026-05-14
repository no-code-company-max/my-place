'use client'

import { Trash2, UserX } from 'lucide-react'
import { RowActions } from '@/shared/ui/row-actions'
import { MemberAvatar } from '@/features/members/public'
import type { MemberSummary } from '@/features/members/public.server'

type Props = {
  member: MemberSummary
  /** Click en la row (área principal) → abre detail panel. */
  onSelect: () => void
  /** Kebab → Expulsar. Si null, NO se muestra la action (sin permiso o target no expulsable). */
  onExpel: (() => void) | null
  /** Kebab → Bloquear. Si null, no se muestra (sin permiso o ya bloqueado). */
  onBlock: (() => void) | null
}

/**
 * Row de un miembro en `/settings/members` (tab Activos).
 *
 * Patrón canónico `detail-from-list` (mirror de `<GroupsAdminPanel>` row):
 * el button principal cubre toda el área tappable y dispara `onSelect`
 * (abre detail panel read-only). El kebab vive como sibling fuera del
 * button para que su tap NO propague al detail.
 *
 * Chips role (owner / admin) son visuales — la edición se delega al
 * detail panel. Avatar usa `<MemberAvatar>` del slice (palette canónica
 * member-1..8 derivada de userId).
 *
 * Actions del kebab dependen de permisos del viewer + estado del target:
 *  - `onExpel === null` cuando el viewer no puede o el target es owner/self.
 *  - `onBlock === null` cuando no puede o el target ya está bloqueado.
 *
 * Si ambos son null, NO se renderea el kebab (no hay acciones disponibles).
 */
export function MemberRow({ member, onSelect, onExpel, onBlock }: Props): React.ReactNode {
  const actions: Array<{
    icon: React.ReactNode
    label: string
    destructive?: boolean
    confirmTitle?: string
    confirmDescription?: string
    confirmActionLabel?: string
    onSelect: () => void
  }> = []

  if (onBlock) {
    actions.push({
      icon: <UserX aria-hidden="true" className="h-4 w-4" />,
      label: 'Bloquear',
      onSelect: onBlock,
    })
  }
  if (onExpel) {
    actions.push({
      icon: <Trash2 aria-hidden="true" className="h-4 w-4" />,
      label: 'Expulsar',
      destructive: true,
      confirmTitle: `¿Expulsar a ${member.user.displayName}?`,
      confirmDescription:
        'El miembro perderá acceso al place. Su contenido permanece — su rastro personal se anonimiza tras 365 días.',
      confirmActionLabel: 'Sí, expulsar',
      onSelect: onExpel,
    })
  }

  const handle = member.user.handle ? `@${member.user.handle}` : null

  return (
    <li className="flex min-h-[56px] items-center gap-2">
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3 text-left hover:bg-neutral-50"
        aria-label={`Ver detalle de ${member.user.displayName}`}
      >
        <MemberAvatar
          userId={member.userId}
          displayName={member.user.displayName}
          avatarUrl={member.user.avatarUrl}
          size={36}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-medium text-neutral-900">
              {member.user.displayName}
            </h3>
            {member.isOwner ? (
              <span className="shrink-0 rounded-full border border-amber-300 px-2 py-0.5 text-[11px] text-amber-700">
                owner
              </span>
            ) : member.isAdmin ? (
              <span className="shrink-0 rounded-full border border-neutral-300 px-2 py-0.5 text-[11px] text-neutral-600">
                admin
              </span>
            ) : null}
          </div>
          {handle ? <p className="truncate text-xs text-neutral-500">{handle}</p> : null}
        </div>
      </button>
      {actions.length > 0 ? (
        <div className="shrink-0 pr-2">
          <RowActions
            triggerLabel={`Acciones para ${member.user.displayName}`}
            chipClassName="hidden"
            forceOverflow={true}
            actions={actions}
          >
            <span aria-hidden />
          </RowActions>
        </div>
      ) : null}
    </li>
  )
}
