/**
 * Skeleton calmo de la zona Biblioteca (`/library`). Refleja el shell
 * real: section header (chip 44×44 + título) + grid de categorías +
 * recientes. Bloques quietos en `bg-soft` — alineado con
 * "nada parpadea, nada grita" (CLAUDE.md).
 */
export default function LibraryLoading() {
  return (
    <section className="flex flex-col gap-4 px-3 py-6" aria-busy="true" aria-live="polite">
      {/* Section header: chip + título */}
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 shrink-0 rounded-[12px] border-[0.5px] border-border bg-soft" />
        <div className="h-9 flex-1 rounded bg-soft" />
      </div>
      {/* Category grid (2 cols mobile) */}
      <div className="grid grid-cols-2 gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-[18px] border-[0.5px] border-border bg-soft" />
        ))}
      </div>
      {/* Recents list */}
      <div className="mt-2 space-y-2">
        <div className="h-5 w-24 rounded bg-soft" />
        <div className="divide-y divide-border border-y-[0.5px] border-border">
          <div className="h-16" />
          <div className="h-16" />
          <div className="h-16" />
        </div>
      </div>
    </section>
  )
}
