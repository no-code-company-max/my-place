/**
 * Inbox universal del usuario. Se accede via `app.place.app` (prod) o `app.localhost:3000` (dev).
 * El middleware hace rewrite del hostname a este path.
 * Placeholder — la UI real llega en Fase 8 del roadmap.
 */
export default function InboxPage() {
  return (
    <main className="min-h-screen p-8">
      <h1 className="mb-2 font-serif text-3xl italic">Inbox</h1>
      <p className="text-place-text-soft">
        Tus places y DMs viven acá. Placeholder — Fase 8 del roadmap.
      </p>
    </main>
  )
}
