import { MemberAvatar } from '@/features/members/public'
import type { MemberDetail } from '@/features/members/public.server'
import { formatAbsoluteTimeLong } from '@/shared/lib/format-date'

type Props = {
  member: MemberDetail
}

/**
 * Header del detalle del miembro (M.6) — Server Component puro.
 *
 * Render: avatar grande + displayName + handle (si existe) + meta line con
 * `joinedAt` (formato absoluto largo, sin urgencia) + role badge + owner badge.
 *
 * **Privacidad (decisión #6 ADR)**: NO muestra email. Owner ve sólo lo
 * estrictamente necesario para gestionar tier/role del miembro. El test
 * verifica explícitamente que el email no aparece en el render.
 *
 * Spec: docs/features/tier-memberships/spec.md § 4 (route detalle).
 * ADR:  docs/decisions/2026-05-02-tier-memberships-model.md § decisión #6.
 */
export function MemberDetailHeader({ member }: Props): React.ReactNode {
  return (
    <header className="flex items-start gap-4">
      <MemberAvatar
        userId={member.userId}
        displayName={member.user.displayName}
        avatarUrl={member.user.avatarUrl}
        size={64}
      />
      <div className="min-w-0 flex-1">
        <h1 className="font-serif text-3xl italic text-text">{member.user.displayName}</h1>
        {member.user.handle ? <p className="text-sm text-muted">@{member.user.handle}</p> : null}
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          {member.isOwner ? (
            <span className="rounded-full border border-amber-400 px-2 py-0.5 text-amber-700">
              owner
            </span>
          ) : null}
          <span className="rounded-full border border-border px-2 py-0.5 text-muted">
            {member.isAdmin ? 'admin' : 'miembro'}
          </span>
          <span className="text-muted">
            Miembro desde {formatAbsoluteTimeLong(member.joinedAt)}
          </span>
        </div>
      </div>
    </header>
  )
}
