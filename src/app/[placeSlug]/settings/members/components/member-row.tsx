import Link from 'next/link'
import { MemberAvatar } from '@/features/members/public'
import type { MemberSummary } from '@/features/members/public.server'

type Props = {
  member: MemberSummary
}

/**
 * Row de un miembro en el directorio. Server Component que envuelve toda
 * la fila en un `<Link>` al detalle owner-only `/settings/members/[userId]`
 * (M.6 — implementado por el otro agente).
 *
 * **Sin métricas vanidosas** (CLAUDE.md): el badge de tier muestra el
 * número de tiers asignados como info de stock — no es un ranking ni
 * una métrica de actividad.
 *
 * **Identidad contextual** (CLAUDE.md, decisión #6 ADR): NO email.
 * Sólo nombre, handle, avatar, rol e isOwner.
 */
export function MemberRow({ member }: Props): React.ReactNode {
  const roleLabel = member.isAdmin ? 'admin' : 'miembro'
  return (
    <Link
      href={`/settings/members/${member.userId}`}
      className="flex flex-1 items-center gap-3 text-sm motion-safe:transition-colors"
    >
      <MemberAvatar
        userId={member.userId}
        displayName={member.user.displayName}
        avatarUrl={member.user.avatarUrl}
        size={32}
      />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{member.user.displayName}</div>
        {member.user.handle ? (
          <div className="truncate text-xs text-neutral-600">@{member.user.handle}</div>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1.5 text-[11px]">
        {member.isOwner ? (
          <span className="rounded-full border border-amber-400 px-2 py-0.5 text-amber-700">
            owner
          </span>
        ) : null}
        <span className="rounded-full border border-neutral-300 px-2 py-0.5 text-neutral-600">
          {roleLabel}
        </span>
        {member.tierCount > 0 ? (
          <span
            className="rounded-full border border-neutral-300 px-2 py-0.5 text-neutral-600"
            aria-label={`${member.tierCount} ${member.tierCount === 1 ? 'tier asignado' : 'tiers asignados'}`}
          >
            {member.tierCount} {member.tierCount === 1 ? 'tier' : 'tiers'}
          </span>
        ) : null}
      </div>
    </Link>
  )
}
