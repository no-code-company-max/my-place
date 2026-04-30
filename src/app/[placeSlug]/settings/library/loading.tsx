/**
 * Skeleton calmo de `/settings/library` mientras la query de
 * categorías se resuelve. Sin spinners agresivos — alineado con
 * "nada parpadea, nada grita" (CLAUDE.md).
 */
export default function Loading() {
  return (
    <div className="space-y-6 p-4 md:p-8">
      <header className="space-y-2">
        <div className="h-3 w-32 rounded bg-soft" />
        <div className="h-9 w-48 rounded bg-soft" />
        <div className="h-3 w-72 rounded bg-soft" />
      </header>
      <div className="rounded-lg border border-border bg-surface p-6">
        <div className="space-y-3">
          <div className="h-4 w-2/3 rounded bg-soft" />
          <div className="h-4 w-1/2 rounded bg-soft" />
        </div>
      </div>
    </div>
  )
}
