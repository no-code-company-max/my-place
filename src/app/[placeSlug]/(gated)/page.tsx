type Props = { params: Promise<{ placeSlug: string }> }

/**
 * Portada del place. Placeholder hasta Fase 7 (portada + zonas).
 */
export default async function PlaceHomePage({ params }: Props) {
  const { placeSlug } = await params
  return (
    <div className="p-8">
      <h1 className="mb-2 font-serif text-3xl italic">{placeSlug}</h1>
      <p className="text-muted">Portada del place. Placeholder — Fase 7 del roadmap.</p>
    </div>
  )
}
