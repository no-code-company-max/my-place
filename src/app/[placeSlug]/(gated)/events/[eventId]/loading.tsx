/**
 * Skeleton del legacy redirect `/events/[eventId]`. Aunque la page
 * resuelve a un `redirect()` server-side hacia `/conversations/...`,
 * mientras la query del evento corre el viewer ve este shell calmo.
 * Bloques quietos, sin shimmer (CLAUDE.md).
 */
export default function EventLegacyDetailLoading() {
  return (
    <div className="pb-6" aria-busy="true" aria-live="polite">
      <div className="h-14 border-b-[0.5px] border-border bg-surface" />
      <div className="space-y-3 px-3 pt-4">
        <div className="h-7 w-2/3 rounded bg-soft" />
        <div className="h-3 w-1/3 rounded bg-soft" />
      </div>
    </div>
  )
}
