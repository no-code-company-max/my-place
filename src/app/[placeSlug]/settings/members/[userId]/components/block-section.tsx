import type { MemberBlockInfo } from '@/features/members/public.server'
import { BlockMemberDialog } from '@/features/members/public'
import { formatAbsoluteTimeLong } from '@/shared/lib/format-date'

type Props = {
  placeId: string
  memberUserId: string
  memberDisplayName: string
  /** Email del viewer — autocompleta el campo `contactEmail` del dialog. */
  actorEmail: string
  /** Estado de bloqueo actual. `null` → target NO está bloqueado. */
  blockInfo: MemberBlockInfo | null
}

/**
 * Sección "Bloquear / Desbloquear miembro" del detalle (G.6).
 *
 * Renderea según `blockInfo`:
 *  - Si `blockInfo` → muestra metadata ("Bloqueado el [fecha] por [...]" +
 *    razón) + botón "Desbloquear miembro" que abre `<BlockMemberDialog mode='unblock'>`.
 *  - Si `null` → botón "Bloquear miembro" que abre `<BlockMemberDialog mode='block'>`.
 *
 * El page padre decide cuándo renderear esta sección (visible si viewer
 * tiene `members:block` AND target no es owner AND target no es self).
 *
 * Spec: docs/features/groups/spec.md § 5.
 */
export function BlockSection({
  placeId,
  memberUserId,
  memberDisplayName,
  actorEmail,
  blockInfo,
}: Props): React.ReactNode {
  if (blockInfo) {
    return (
      <section className="space-y-3">
        <h2 className="font-title text-base font-semibold text-text">Bloqueado</h2>
        <div className="space-y-2 rounded-md border border-border bg-soft p-4 text-sm text-text">
          <p>
            Bloqueado el <strong>{formatAbsoluteTimeLong(blockInfo.blockedAt)}</strong>
            {blockInfo.blockedByDisplayName ? (
              <>
                {' '}
                por <strong>{blockInfo.blockedByDisplayName}</strong>
              </>
            ) : null}
            .
          </p>
          {blockInfo.blockedReason ? (
            <p>
              <span className="text-muted">Razón:</span> {blockInfo.blockedReason}
            </p>
          ) : null}
        </div>
        <BlockMemberDialog
          mode={{
            kind: 'unblock',
            placeId,
            memberUserId,
            memberDisplayName,
            actorEmail,
          }}
          trigger={
            <button
              type="button"
              className="rounded-md border border-border px-3 py-2 text-sm text-text hover:bg-soft"
            >
              Desbloquear miembro
            </button>
          }
        />
      </section>
    )
  }
  return (
    <section className="space-y-3">
      <h2 className="font-title text-base font-semibold text-text">Bloquear miembro</h2>
      <p className="text-sm text-muted">
        Bloquear corta el acceso al place pero mantiene la membership. Es reversible.
      </p>
      <BlockMemberDialog
        mode={{
          kind: 'block',
          placeId,
          memberUserId,
          memberDisplayName,
          actorEmail,
        }}
        trigger={
          <button
            type="button"
            className="rounded-md border border-border px-3 py-2 text-sm text-text hover:bg-soft"
          >
            Bloquear miembro
          </button>
        }
      />
    </section>
  )
}
