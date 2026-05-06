/**
 * Skeleton de `/settings/hours`. Refleja el shell real: header
 * (breadcrumb + título + descripción) + sección "Estado actual" +
 * form de horario. Bloques quietos (CLAUDE.md cozytech).
 */
export default function SettingsHoursLoading() {
  return (
    <div className="space-y-8 p-8" aria-busy="true" aria-live="polite">
      <header className="space-y-2">
        <div className="h-3 w-40 rounded bg-soft" />
        <div className="h-9 w-40 rounded bg-soft" />
        <div className="h-3 w-2/3 rounded bg-soft" />
      </header>
      <section className="space-y-2 rounded-md border border-border bg-surface p-4">
        <div className="h-3 w-32 rounded bg-soft" />
        <div className="h-5 w-1/2 rounded bg-soft" />
      </section>
      <section className="space-y-3">
        <div className="h-5 w-44 rounded bg-soft" />
        <div className="h-32 rounded-md border border-border bg-surface" />
        <div className="h-10 w-32 rounded-md bg-soft" />
      </section>
    </div>
  )
}
