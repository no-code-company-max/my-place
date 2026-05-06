/**
 * Skeleton del detalle de item de biblioteca. Refleja la estructura
 * real: header bar sticky + chip categoría + título + meta autor +
 * cuerpo + reactions. Bloques quietos, sin shimmer (CLAUDE.md).
 */
export default function LibraryItemDetailLoading() {
  return (
    <div className="pb-32" aria-busy="true" aria-live="polite">
      {/* LibraryItemHeaderBar sticky */}
      <div className="h-14 border-b-[0.5px] border-border bg-surface" />
      {/* Header: chip + título + meta */}
      <header className="space-y-3 px-3 pt-4">
        <div className="h-6 w-32 rounded-full bg-soft" />
        <div className="h-8 w-3/4 rounded bg-soft" />
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-soft" />
          <div className="h-3 w-40 rounded bg-soft" />
        </div>
      </header>
      {/* Body */}
      <div className="space-y-2 px-3 pt-4">
        <div className="h-4 w-full rounded bg-soft" />
        <div className="h-4 w-11/12 rounded bg-soft" />
        <div className="h-4 w-5/6 rounded bg-soft" />
        <div className="h-4 w-3/4 rounded bg-soft" />
      </div>
      {/* ReactionBar */}
      <div className="px-3 pt-6">
        <div className="h-9 w-44 rounded-full bg-soft" />
      </div>
    </div>
  )
}
