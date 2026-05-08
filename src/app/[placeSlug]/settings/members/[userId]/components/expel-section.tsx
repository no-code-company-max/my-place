import { ExpelMemberDialog } from '@/features/members/moderation/public'

type Props = {
  placeId: string
  memberUserId: string
  memberDisplayName: string
  actorEmail: string
}

/**
 * Sección "Expulsar miembro" del detalle (G.6) — owner-only.
 *
 * Render: copy explicativo + botón "Expulsar miembro" que abre
 * `<ExpelMemberDialog>`. El page padre decide cuándo renderear esta sección
 * (visible si viewer es owner AND target no es owner AND target no es self).
 *
 * Spec: docs/features/groups/spec.md § 5.
 */
export function ExpelSection({
  placeId,
  memberUserId,
  memberDisplayName,
  actorEmail,
}: Props): React.ReactNode {
  return (
    <section className="space-y-3">
      <h2 className="font-title text-base font-semibold text-text">Expulsar miembro</h2>
      <p className="text-sm text-muted">
        Expulsar termina la membership. No es reversible — para volver, hay que invitar de nuevo.
      </p>
      <ExpelMemberDialog
        placeId={placeId}
        memberUserId={memberUserId}
        memberDisplayName={memberDisplayName}
        actorEmail={actorEmail}
        trigger={
          <button
            type="button"
            className="rounded-md border border-border px-3 py-2 text-sm text-text hover:bg-soft"
          >
            Expulsar miembro
          </button>
        }
      />
    </section>
  )
}
