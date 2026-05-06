/**
 * Skeleton del detalle de miembro (`/settings/members/[userId]`).
 * Alta prioridad: la page real dispara 6 queries paralelas (member,
 * tiers, assignments, groups, memberGroups, blockInfo). Refleja el
 * shell: back button + header avatar/nombre + secciones (tiers, grupos,
 * bloquear/expulsar). Bloques quietos (CLAUDE.md cozytech).
 */
export default function SettingsMemberDetailLoading() {
  return (
    <div className="space-y-6 px-3 py-6 md:px-4 md:py-8" aria-busy="true" aria-live="polite">
      <div className="h-4 w-44 rounded bg-soft" />
      {/* MemberDetailHeader */}
      <header className="flex items-center gap-4">
        <div className="h-16 w-16 shrink-0 rounded-full bg-soft" />
        <div className="space-y-2">
          <div className="h-7 w-56 rounded bg-soft" />
          <div className="h-3 w-32 rounded bg-soft" />
        </div>
      </header>
      {/* Sections placeholders */}
      <section className="space-y-2">
        <div className="h-5 w-40 rounded bg-soft" />
        <div className="h-20 rounded-md border border-border bg-surface" />
      </section>
      <section className="space-y-2">
        <div className="h-5 w-40 rounded bg-soft" />
        <div className="h-20 rounded-md border border-border bg-surface" />
      </section>
      <section className="space-y-2">
        <div className="h-5 w-40 rounded bg-soft" />
        <div className="h-16 rounded-md border border-border bg-surface" />
      </section>
    </div>
  )
}
