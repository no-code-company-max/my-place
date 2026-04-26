/**
 * Skeleton simple para el bucket de conversaciones. Sin animaciones ruidosas
 * — líneas grises quietas que desaparecen al montar la página real.
 */
export default function ConversationsLoading() {
  return (
    <div className="space-y-4 p-4 md:p-8" aria-busy="true" aria-live="polite">
      <div className="bg-accent/50 h-8 w-48 rounded" />
      <div className="bg-accent/30 h-4 w-72 rounded" />
      <div className="space-y-3 pt-6">
        <div className="h-20 rounded-lg border border-border bg-surface" />
        <div className="h-20 rounded-lg border border-border bg-surface" />
        <div className="h-20 rounded-lg border border-border bg-surface" />
      </div>
    </div>
  )
}
