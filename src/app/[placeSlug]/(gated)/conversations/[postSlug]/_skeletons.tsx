/**
 * Skeletons matched-dimension del thread detail (R.6.4 layout).
 *
 * Cada skeleton respeta width/height del componente final que reemplaza
 * para que la transición skeleton → contenido sea cero CLS (Cumulative
 * Layout Shift). Sin shimmer agresivo — bloques quietos `bg-soft`,
 * alineados al principio cozytech ("nada parpadea, nada grita").
 *
 * Streaming agresivo: cuando el page returna su JSX, estos skeletons
 * pintan inmediatamente; cada Suspense child los reemplaza cuando su
 * query resuelve. Ver `docs/architecture.md` § "Streaming agresivo del
 * shell" para el patrón canónico.
 */
export function ThreadContentSkeleton(): React.ReactNode {
  return (
    <article aria-busy="true" aria-live="polite" className="space-y-4 px-3 pt-4">
      <header className="space-y-2">
        <div className="h-8 w-3/4 rounded bg-soft" />
      </header>
      <div className="space-y-2">
        <div className="h-4 w-full rounded bg-soft" />
        <div className="h-4 w-11/12 rounded bg-soft" />
        <div className="h-4 w-5/6 rounded bg-soft" />
        <div className="h-4 w-2/3 rounded bg-soft" />
      </div>
      <div className="flex items-center gap-2.5">
        <div className="h-7 w-7 rounded-full bg-soft" />
        <div className="h-3 w-44 rounded bg-soft" />
      </div>
    </article>
  )
}
