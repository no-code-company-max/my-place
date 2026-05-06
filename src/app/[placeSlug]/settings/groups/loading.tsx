/**
 * Skeleton de `/settings/groups`. Refleja el shell real: PageHeader +
 * heading "Grupos" + count + lista minimalista de rows (post refactor
 * mayo 2026). Bloques quietos (CLAUDE.md cozytech).
 */
export default function SettingsGroupsLoading() {
  return (
    <div className="space-y-6 px-3 py-6 md:px-4 md:py-8" aria-busy="true" aria-live="polite">
      <header className="space-y-2">
        <div className="h-9 w-40 rounded bg-soft" />
        <div className="h-3 w-3/4 rounded bg-soft" />
      </header>
      <section className="space-y-3">
        <div className="border-b border-border pb-2">
          <div className="h-6 w-24 rounded bg-soft" />
        </div>
        <div className="h-3 w-32 rounded bg-soft" />
        <ul className="divide-y divide-border border-y-[0.5px] border-border">
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex items-center justify-between py-3">
              <div className="space-y-2">
                <div className="h-4 w-44 rounded bg-soft" />
                <div className="h-3 w-32 rounded bg-soft" />
              </div>
              <div className="h-5 w-12 rounded-full bg-soft" />
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
