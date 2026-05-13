'use client'

import { useState } from 'react'
import { permissionLabel, type Permission } from '@/features/groups/domain/permissions'
import type { GroupMembership, PermissionGroup } from '@/features/groups/domain/types'
import { MemberAvatar } from '@/features/members/public'
import { DeleteGroupConfirm } from './delete-group-confirm'
import { GroupFormSheet } from './group-form-sheet'
import { GroupMembersSheet } from './group-members-sheet'

type AvailableMember = {
  userId: string
  displayName: string
  handle: string | null
  avatarUrl: string | null
}

type Props = {
  /** Slug del place — `<DeleteGroupConfirm>` lo necesita para el redirect
   *  post-delete. */
  placeSlug: string
  group: PermissionGroup
  /** Miembros actuales del grupo — render de la lista + sheet de
   *  miembros. */
  members: ReadonlyArray<GroupMembership>
  /** Miembros activos del place que NO están en el grupo — alimentan el
   *  sheet de miembros. */
  availableMembers: ReadonlyArray<AvailableMember>
}

/**
 * Vista detalle de un grupo. Client Component porque orquesta los 3
 * overlays (form sheet, members sheet, delete confirm) con un
 * discriminated union de estado — mismo patrón que `<CategoryListAdmin>`
 * del slice `library`.
 *
 * Estructura visual:
 *  - Section "Permisos" — chips con label español de cada permiso.
 *  - Section "Scope de biblioteca" — lista de categorías scopadas (si
 *    el grupo tiene scope library).
 *  - Section "Miembros" — avatares + nombres + handle, con botón
 *    "Gestionar miembros" que abre el sheet.
 *  - Section "Acciones" — botones "Editar" (sheet) y "Eliminar"
 *    (confirm).
 *
 * El delete está bloqueado por la UI cuando el grupo es preset o tiene
 * miembros (mismo guard que el `DeleteGroupButton` viejo). Defense in
 * depth: el server action también lo rechaza con discriminated union
 * return.
 *
 * Headings canónicos en cada section: `<h2 className="font-serif text-xl
 * pb-2 border-b" style={{ borderColor: 'var(--border)' }}>`. Ver
 * `docs/ux-patterns.md` § "Section grouping with semantic headings".
 */
type SheetState = { kind: 'closed' } | { kind: 'edit' } | { kind: 'members' } | { kind: 'delete' }

export function GroupDetailView({
  placeSlug,
  group,
  members,
  availableMembers,
}: Props): React.ReactNode {
  const [sheet, setSheet] = useState<SheetState>({ kind: 'closed' })

  function close(): void {
    setSheet({ kind: 'closed' })
  }

  // Bloqueos del delete (defense in depth con el server action).
  const deleteBlockedReason = group.isPreset
    ? 'El preset Administradores no se puede eliminar.'
    : group.memberCount > 0
      ? 'Quitá los miembros del grupo antes de eliminar.'
      : null

  // Mode estable para `<GroupFormSheet>` — `open` deriva del kind, el
  // payload de edit se construye desde `group`.
  const formOpen = sheet.kind === 'edit'
  const formMode = {
    kind: 'edit' as const,
    groupId: group.id,
    initialName: group.name,
    initialDescription: group.description,
    initialPermissions: group.permissions,
    isPreset: group.isPreset,
  }

  const membersOpen = sheet.kind === 'members'
  const deleteOpen = sheet.kind === 'delete'

  return (
    <>
      <section aria-labelledby="group-permissions-heading" className="space-y-3">
        <h2
          id="group-permissions-heading"
          className="border-b pb-2 font-serif text-xl"
          style={{ borderColor: 'var(--border)' }}
        >
          Permisos
        </h2>
        <PermissionChips permissions={group.permissions} />
      </section>

      <section aria-labelledby="group-members-heading" className="space-y-3">
        <h2
          id="group-members-heading"
          className="border-b pb-2 font-serif text-xl"
          style={{ borderColor: 'var(--border)' }}
        >
          Miembros ({group.memberCount})
        </h2>
        {members.length === 0 ? (
          <p className="text-sm italic text-neutral-500">Este grupo no tiene miembros asignados.</p>
        ) : (
          <ul className="divide-y divide-neutral-200 border-y border-neutral-200">
            {members.map((m) => (
              <li key={m.id} className="flex min-h-[56px] items-center gap-3 py-2">
                <MemberAvatar
                  userId={m.userId}
                  displayName={m.user.displayName}
                  avatarUrl={m.user.avatarUrl}
                  size={32}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{m.user.displayName}</p>
                  {m.user.handle ? (
                    <p className="truncate text-xs text-neutral-600">@{m.user.handle}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={() => setSheet({ kind: 'members' })}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md border border-dashed border-neutral-300 px-4 text-sm font-medium text-neutral-600 hover:border-neutral-500"
        >
          <span aria-hidden="true">+</span> Gestionar miembros
        </button>
      </section>

      <section aria-labelledby="group-actions-heading" className="space-y-3">
        <h2
          id="group-actions-heading"
          className="border-b pb-2 font-serif text-xl"
          style={{ borderColor: 'var(--border)' }}
        >
          Acciones
        </h2>
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setSheet({ kind: 'edit' })}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-neutral-300 px-4 text-sm"
          >
            Editar grupo
          </button>
          {deleteBlockedReason ? (
            <button
              type="button"
              disabled
              title={deleteBlockedReason}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-neutral-300 px-4 text-sm text-neutral-400 opacity-60"
              aria-label={`No se puede eliminar ${group.name}`}
            >
              Eliminar grupo
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setSheet({ kind: 'delete' })}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-md px-4 text-sm font-medium text-red-600 hover:bg-red-50"
              aria-label={`Eliminar grupo ${group.name}`}
            >
              Eliminar grupo
            </button>
          )}
          {deleteBlockedReason ? (
            <p className="text-xs text-neutral-600">{deleteBlockedReason}</p>
          ) : null}
        </div>
      </section>

      <GroupFormSheet
        open={formOpen}
        onOpenChange={(next) => {
          if (!next) close()
        }}
        mode={formMode}
      />

      <GroupMembersSheet
        open={membersOpen}
        onOpenChange={(next) => {
          if (!next) close()
        }}
        groupId={group.id}
        groupName={group.name}
        currentMembers={members}
        availableMembers={availableMembers}
      />

      <DeleteGroupConfirm
        open={deleteOpen}
        onOpenChange={(next) => {
          if (!next) close()
        }}
        groupId={group.id}
        groupName={group.name}
        placeSlug={placeSlug}
      />
    </>
  )
}

function PermissionChips({
  permissions,
}: {
  permissions: ReadonlyArray<Permission>
}): React.ReactNode {
  if (permissions.length === 0) {
    return (
      <p className="text-sm italic text-neutral-500">
        Sin permisos asignados. Editá el grupo para asignar permisos.
      </p>
    )
  }
  return (
    <ul className="flex flex-wrap gap-1.5">
      {permissions.map((p) => (
        <li
          key={p}
          className="rounded-md border border-neutral-300 px-2 py-1 text-xs text-neutral-700"
        >
          {permissionLabel(p)}
        </li>
      ))}
    </ul>
  )
}
