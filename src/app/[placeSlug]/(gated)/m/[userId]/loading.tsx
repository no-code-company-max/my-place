/**
 * Skeleton del perfil contextual de un miembro (`/m/[userId]`). Refleja
 * el shell real: avatar + nombre + handle + chip rol + sección
 * "Contribuciones" placeholder. Sin animaciones (CLAUDE.md cozytech).
 */
export default function MemberProfileLoading() {
  return (
    <div className="space-y-8 p-8" aria-busy="true" aria-live="polite">
      <header className="flex items-center gap-4">
        <div className="h-16 w-16 shrink-0 rounded-full bg-soft" />
        <div className="space-y-2">
          <div className="h-8 w-56 rounded bg-soft" />
          <div className="h-3 w-32 rounded bg-soft" />
          <div className="flex items-center gap-2 pt-1">
            <div className="h-5 w-16 rounded-full bg-soft" />
            <div className="h-3 w-24 rounded bg-soft" />
          </div>
        </div>
      </header>
      <section className="rounded-md border border-dashed border-border p-6">
        <div className="h-5 w-40 rounded bg-soft" />
        <div className="mt-3 h-3 w-2/3 rounded bg-soft" />
      </section>
    </div>
  )
}
