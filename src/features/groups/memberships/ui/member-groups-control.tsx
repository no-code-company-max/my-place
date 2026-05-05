'use client'

import { useState, useTransition } from 'react'
import { toast } from '@/shared/ui/toaster'
import {
  addMemberToGroupAction,
  removeMemberFromGroupAction,
  type GroupSummary,
} from '@/features/groups/public'
import { friendlyGroupErrorMessage } from '@/features/groups/ui/errors'

type Props = {
  /** Place donde se gestiona la pertenencia. */
  placeId: string
  /** Member que se gestiona. */
  memberUserId: string
  /** Grupos a los que ya pertenece el miembro (incluye preset). */
  currentGroups: ReadonlyArray<GroupSummary>
  /** Grupos del place a los que el miembro NO pertenece todavía. */
  availableGroups: ReadonlyArray<GroupSummary>
}

/**
 * Control de pertenencia de un miembro a grupos. Client island.
 *
 * Vive en `/settings/members/[userId]` (G.6 lo monta). Owner-only.
 *
 * - Lista de grupos actuales con badge `(preset)` si aplica + botón
 *   "Quitar" inline.
 * - Dropdown de grupos disponibles + botón "Asignar".
 *
 * Usa Server Actions de `groups/public` que disparan `revalidatePath`
 * — los datos se refrescan al completar.
 */
export function MemberGroupsControl({
  placeId,
  memberUserId,
  currentGroups,
  availableGroups,
}: Props): React.ReactNode {
  const [pending, startTransition] = useTransition()
  const [selectedGroupId, setSelectedGroupId] = useState<string>(availableGroups[0]?.id ?? '')

  function handleAdd(): void {
    if (!selectedGroupId) {
      toast.error('Elegí un grupo para asignar.')
      return
    }
    startTransition(async () => {
      try {
        const result = await addMemberToGroupAction({
          groupId: selectedGroupId,
          userId: memberUserId,
        })
        if (!result.ok) {
          if (result.error === 'target_user_not_member') {
            toast.error('Este miembro ya no está activo en el place.')
          } else if (result.error === 'target_is_owner') {
            toast.error('El owner no puede asignarse a grupos.')
          } else if (result.error === 'already_in_group') {
            toast.error('El miembro ya está en ese grupo.')
          }
          return
        }
        toast.success('Asignado al grupo.')
      } catch (err) {
        toast.error(friendlyGroupErrorMessage(err))
      }
    })
  }

  function handleRemove(groupId: string, groupName: string): void {
    startTransition(async () => {
      try {
        const result = await removeMemberFromGroupAction({
          groupId,
          userId: memberUserId,
        })
        if (!result.ok) {
          if (result.error === 'not_in_group') {
            toast.message(`Ya no estaba en ${groupName}.`)
          }
          return
        }
        toast.success(`Removido de ${groupName}.`)
      } catch (err) {
        toast.error(friendlyGroupErrorMessage(err))
      }
    })
  }

  // El placeId se acepta para futuras refinaciones (filtros adicionales),
  // pero hoy las actions ya validan owner del place dueño del grupo.
  void placeId

  return (
    <div className="space-y-3">
      {currentGroups.length === 0 ? (
        <p className="text-sm text-muted">Este miembro no está en ningún grupo.</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {currentGroups.map((g) => (
            <li
              key={g.id}
              className="flex items-center justify-between gap-2 px-3 py-2 text-sm text-text"
            >
              <div className="min-w-0 flex-1 truncate">
                <span>{g.name}</span>
                {g.isPreset && (
                  <span className="ml-2 rounded-md bg-soft px-1.5 py-0.5 text-xs text-muted">
                    preset
                  </span>
                )}
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() => handleRemove(g.id, g.name)}
                className="rounded-md border border-border px-2 py-1 text-xs text-muted hover:text-text disabled:opacity-60"
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}

      {availableGroups.length === 0 ? (
        <p className="text-xs text-muted">No hay otros grupos disponibles para este miembro.</p>
      ) : (
        <div className="flex items-center gap-2">
          <select
            value={selectedGroupId}
            onChange={(e) => setSelectedGroupId(e.target.value)}
            disabled={pending}
            className="flex-1 rounded-md border border-border bg-bg px-3 py-2 text-sm text-text focus:border-text focus:outline-none"
          >
            {availableGroups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
                {g.isPreset ? ' (preset)' : ''}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={pending || !selectedGroupId}
            onClick={handleAdd}
            className="rounded-md bg-accent px-3 py-2 text-sm text-bg disabled:opacity-60"
          >
            {pending ? 'Asignando…' : 'Asignar'}
          </button>
        </div>
      )}
    </div>
  )
}
