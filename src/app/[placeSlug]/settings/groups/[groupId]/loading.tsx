/**
 * Skeleton del detalle de un grupo (`/settings/groups/[groupId]`).
 * Refleja el shell real: back link + PageHeader + GroupDetailView
 * (permisos, scope, miembros). Bloques quietos (CLAUDE.md cozytech).
 */
export default function SettingsGroupDetailLoading() {
  return (
    <div className="space-y-6 px-3 py-6 md:px-4 md:py-8" aria-busy="true" aria-live="polite">
      <div className="h-4 w-40 rounded bg-soft" />
      <header className="space-y-2">
        <div className="h-9 w-56 rounded bg-soft" />
        <div className="h-3 w-2/3 rounded bg-soft" />
      </header>
      <section className="space-y-2">
        <div className="h-5 w-32 rounded bg-soft" />
        <div className="h-24 rounded-md border border-border bg-surface" />
      </section>
      <section className="space-y-2">
        <div className="h-5 w-32 rounded bg-soft" />
        <div className="h-20 rounded-md border border-border bg-surface" />
      </section>
    </div>
  )
}
