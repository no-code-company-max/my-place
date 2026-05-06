/**
 * Skeleton del directorio de miembros (`/settings/members`). Refleja el
 * shell real: header (breadcrumb + título + count) + lista de miembros
 * con divisores. Bloques quietos, sin shimmer (CLAUDE.md cozytech).
 */
export default function SettingsMembersLoading() {
  return (
    <div className="space-y-10 p-8" aria-busy="true" aria-live="polite">
      <header className="space-y-2">
        <div className="h-3 w-40 rounded bg-soft" />
        <div className="h-9 w-48 rounded bg-soft" />
        <div className="h-3 w-32 rounded bg-soft" />
      </header>
      <section className="space-y-3">
        <div className="h-6 w-24 rounded bg-soft" />
        <ul className="divide-y divide-border border-y-[0.5px] border-border">
          {[0, 1, 2, 3, 4].map((i) => (
            <li key={i} className="flex items-center justify-between py-3">
              <div className="space-y-2">
                <div className="h-4 w-40 rounded bg-soft" />
                <div className="h-3 w-24 rounded bg-soft" />
              </div>
              <div className="h-5 w-16 rounded-full bg-soft" />
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
