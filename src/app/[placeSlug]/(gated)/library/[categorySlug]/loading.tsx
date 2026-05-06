/**
 * Skeleton de la sub-page de categoría (`/library/[categorySlug]`).
 * Header bar sticky placeholder + título + lista de items. Sin
 * animaciones — coherencia cozytech (CLAUDE.md).
 */
export default function LibraryCategoryLoading() {
  return (
    <div className="pb-6" aria-busy="true" aria-live="polite">
      {/* CategoryHeaderBar sticky (56px) */}
      <div className="h-14 border-b-[0.5px] border-border bg-surface" />
      {/* Title block */}
      <header className="mt-4 px-3">
        <div className="h-8 w-2/3 rounded bg-soft" />
        <div className="mt-2 h-3 w-24 rounded bg-soft" />
      </header>
      {/* Item rows */}
      <div className="mt-4 divide-y divide-border border-y-[0.5px] border-border">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-3">
            <div className="h-10 w-10 shrink-0 rounded-[10px] bg-soft" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 rounded bg-soft" />
              <div className="h-3 w-1/3 rounded bg-soft" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
