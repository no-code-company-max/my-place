import type { ActiveMember } from '@/features/members/public.server'

type Props = {
  members: ActiveMember[]
}

/**
 * Lista read-only mini de miembros activos del place. Se monta en
 * `/settings/access` para que admins (que ya no tienen acceso al
 * directorio owner-only en `/settings/members`) preserven la
 * visibilidad básica de "quién está".
 *
 * Render minimalista: avatares + nombres + role badges. SIN search,
 * filtros, click al detalle, ni acciones — eso vive en el directorio
 * owner-only. Decisión #12 del plan TierMemberships
 * (`docs/plans/2026-05-02-tier-memberships-and-directory.md`).
 *
 * Server Component puro: recibe `members` por props (el page hace
 * `listActiveMembers`), no toca Prisma ni server-only.
 */
export function ActiveMembersMini({ members }: Props): React.ReactNode {
  if (members.length === 0) {
    return (
      <p className="text-sm italic text-neutral-500">
        Este place todavía no tiene miembros activos.
      </p>
    )
  }
  return (
    <ul className="divide-y divide-neutral-200 border-y border-neutral-200">
      {members.map((m) => (
        <li
          key={m.membershipId}
          className="flex min-h-[56px] items-center justify-between gap-3 py-2 text-sm"
        >
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">{m.user.displayName}</div>
            {m.user.handle ? (
              <div className="truncate text-xs text-neutral-600">@{m.user.handle}</div>
            ) : null}
          </div>
          <div className="flex shrink-0 gap-1.5 text-[11px]">
            {m.isOwner ? (
              <span className="rounded-full border border-amber-400 px-2 py-0.5 text-amber-700">
                owner
              </span>
            ) : null}
            <span className="rounded-full border border-neutral-300 px-2 py-0.5 text-neutral-600">
              {m.isAdmin ? 'admin' : 'miembro'}
            </span>
          </div>
        </li>
      ))}
    </ul>
  )
}
