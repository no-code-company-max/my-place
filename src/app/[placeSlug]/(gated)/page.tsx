import { notFound } from 'next/navigation'
import { loadPlaceBySlug } from '@/shared/lib/place-loader'

type Props = { params: Promise<{ placeSlug: string }> }

/**
 * Portada del place. Placeholder hasta Fase 7 (portada + zonas).
 * Header tipográfico unificado con `<ThreadsSectionHeader>` y la
 * page de eventos: 26px / 700 / Fraunces / tracking -0.6px.
 *
 * Padding lateral 12px (`px-3`) consistente con el resto de zonas
 * — el shell viewport queda libre, cada page maneja su padding.
 */
export default async function PlaceHomePage({ params }: Props) {
  const { placeSlug } = await params
  const place = await loadPlaceBySlug(placeSlug)
  if (!place) notFound()

  return (
    <div className="px-3 py-8">
      <h1 className="font-title text-[26px] font-bold tracking-[-0.6px] text-text">{place.name}</h1>
      <p className="mt-2 text-sm text-muted">
        Portada del place. Placeholder — Fase 7 del roadmap.
      </p>
    </div>
  )
}
