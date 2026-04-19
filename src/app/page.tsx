/**
 * Landing pública (`place.app` en prod, `localhost:3000` en dev).
 * Placeholder — el diseño final llega en Fase 8 del roadmap.
 */
export default function MarketingHomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="max-w-xl text-center">
        <h1 className="mb-4 font-serif text-5xl italic">Place</h1>
        <p className="text-place-text-medium">
          Un lugar digital pequeño e íntimo para hasta 150 personas.
        </p>
        <p className="mt-8 text-sm text-place-text-whisper">
          Landing placeholder · Fase 8 del roadmap
        </p>
      </div>
    </main>
  )
}
