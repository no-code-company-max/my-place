'use client'

import { useState } from 'react'
import { MemberAvatar } from './member-avatar'
import { ResendInvitationButton } from '@/features/members/invitations/public'
import { InviteOwnerSheet } from '@/features/members/invitations/public'
import { LeavePlaceDialog } from '@/features/members/profile/public'
import { TransferOwnershipSheet } from '@/features/places/public'
import type { PendingInvitation } from '../domain/types'

/**
 * Orquestador del panel de acceso del place.
 *
 * Estructura: una sección **"Owners"** que combina owners activos +
 * invitaciones pendientes con `asOwner=true` en una única lista con chips
 * (`activo` / `pendiente`). Action buttons abren overlays:
 * - "+ Invitar owner" → `<InviteOwnerSheet>` (force `asOwner=true`).
 * - "Transferir ownership" (solo owners) → `<TransferOwnershipSheet>`.
 * - "Salir del place" → `<LeavePlaceDialog>` (confirm modal).
 *
 * Decisión 2026-05-03: `/settings/access` es exclusivamente sobre ownership.
 * Member/admin invites se moverán a `/settings/members` en un flow futuro;
 * acá ya no se exponen.
 *
 * Client Component porque mantiene state para los 3 overlays. El page padre
 * sigue siendo Server Component que carga data y se la pasa por props.
 */

type OwnerActive = {
  userId: string
  membershipId: string
  displayName: string
  handle: string | null
  avatarUrl: string | null
  joinedAt: Date
}

type OwnerCandidate = {
  userId: string
  displayName: string
  handle: string | null
}

type Props = {
  placeSlug: string
  isOwner: boolean
  appUrl: string
  /** Owners activos del place (members con `isOwner=true`). */
  activeOwners: OwnerActive[]
  /** Invitaciones pendientes con `asOwner=true` (filtradas en el page). */
  pendingOwnerInvites: PendingInvitation[]
  /** Candidatos para transferir ownership (members activos ≠ actor). Vacío
   *  cuando el viewer no es owner — el botón Transferir tampoco se renderiza. */
  transferCandidates: OwnerCandidate[]
}

type SheetState = { kind: 'closed' } | { kind: 'invite' } | { kind: 'transfer' } | { kind: 'leave' }

export function OwnersAccessPanel({
  placeSlug,
  isOwner,
  appUrl,
  activeOwners,
  pendingOwnerInvites,
  transferCandidates,
}: Props): React.ReactNode {
  const [sheet, setSheet] = useState<SheetState>({ kind: 'closed' })

  function close(): void {
    setSheet({ kind: 'closed' })
  }

  const totalActive = activeOwners.length
  const totalPending = pendingOwnerInvites.length

  return (
    <>
      <section aria-labelledby="access-owners-heading" className="space-y-3">
        <div>
          <h2
            id="access-owners-heading"
            className="border-b pb-2 font-serif text-xl"
            style={{ borderColor: 'var(--border)' }}
          >
            Owners
          </h2>
          <p className="mt-1 text-xs text-neutral-600">
            {totalActive} {totalActive === 1 ? 'activo' : 'activos'}
            {totalPending > 0 ? (
              <>
                {' '}
                · {totalPending} {totalPending === 1 ? 'pendiente' : 'pendientes'}
              </>
            ) : null}
            . El owner administra todo el place y puede invitar otros owners.
          </p>
        </div>

        {isOwner ? (
          <button
            type="button"
            onClick={() => setSheet({ kind: 'invite' })}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md border border-dashed border-neutral-300 px-4 text-sm font-medium text-neutral-600 hover:border-neutral-500"
          >
            <span aria-hidden="true">+</span> Invitar owner
          </button>
        ) : null}

        {totalActive === 0 && totalPending === 0 ? (
          <p className="text-sm italic text-neutral-500">
            Este place todavía no tiene owners. (No debería pasar — verificá la consola.)
          </p>
        ) : (
          <ul className="divide-y divide-neutral-200 border-y border-neutral-200">
            {activeOwners.map((o) => (
              <li
                key={o.membershipId}
                className="flex min-h-[56px] items-center gap-3 py-2 text-sm"
              >
                <MemberAvatar
                  userId={o.userId}
                  displayName={o.displayName}
                  avatarUrl={o.avatarUrl}
                  size={32}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{o.displayName}</div>
                  {o.handle ? (
                    <div className="truncate text-xs text-neutral-600">@{o.handle}</div>
                  ) : null}
                </div>
                <span className="rounded-full border border-neutral-300 px-2 py-0.5 text-[11px] text-neutral-600">
                  activo
                </span>
              </li>
            ))}

            {pendingOwnerInvites.map((inv) => (
              <li key={inv.id} className="flex min-h-[56px] items-center gap-3 py-2 text-sm">
                <div
                  aria-hidden
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs text-neutral-500"
                >
                  {inv.email.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{inv.email}</div>
                  <div className="truncate text-xs text-neutral-600">
                    Invitado por {inv.inviter.displayName} · vence {formatDate(inv.expiresAt)}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="rounded-full border border-amber-300 px-2 py-0.5 text-[11px] text-amber-700">
                    pendiente
                  </span>
                  <ResendInvitationButton invitationId={inv.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {isOwner ? (
        <section aria-labelledby="access-transfer-heading" className="space-y-3">
          <div>
            <h2
              id="access-transfer-heading"
              className="border-b pb-2 font-serif text-xl"
              style={{ borderColor: 'var(--border)' }}
            >
              Transferir ownership
            </h2>
            <p className="mt-1 text-sm text-neutral-600">
              Cedé ownership a otro miembro. Si lo dejás sin la opción de salir, quedás co-owner.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSheet({ kind: 'transfer' })}
            className="inline-flex min-h-12 w-full items-center justify-center rounded-md border border-neutral-300 px-4 text-sm font-medium hover:bg-neutral-50"
          >
            Transferir ownership
          </button>
        </section>
      ) : null}

      <section aria-labelledby="access-leave-heading" className="space-y-3">
        <div>
          <h2
            id="access-leave-heading"
            className="border-b pb-2 font-serif text-xl"
            style={{ borderColor: 'var(--border)' }}
          >
            Salir del place
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            Tu acceso se cierra y tu contenido queda atribuido 365 días antes de anonimizarse. Si
            sos el único owner, transferí ownership primero.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setSheet({ kind: 'leave' })}
          className="inline-flex min-h-12 w-full items-center justify-center rounded-md px-4 text-sm font-medium text-red-600 hover:bg-red-50"
        >
          Salir de este place
        </button>
      </section>

      <InviteOwnerSheet
        open={sheet.kind === 'invite'}
        onOpenChange={(next) => {
          if (!next) close()
        }}
        placeSlug={placeSlug}
      />

      <TransferOwnershipSheet
        open={sheet.kind === 'transfer'}
        onOpenChange={(next) => {
          if (!next) close()
        }}
        placeSlug={placeSlug}
        candidates={transferCandidates}
      />

      <LeavePlaceDialog
        open={sheet.kind === 'leave'}
        onOpenChange={(next) => {
          if (!next) close()
        }}
        placeSlug={placeSlug}
        appUrl={appUrl}
      />
    </>
  )
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short' }).format(d)
}
