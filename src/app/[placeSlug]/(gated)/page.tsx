import { notFound } from 'next/navigation'
import { loadPlaceBySlug } from '@/shared/lib/place-loader'
import { PageIcon } from '@/shared/ui/page-icon'

type Props = { params: Promise<{ placeSlug: string }> }

/**
 * Portada del place. Placeholder hasta Fase 7 (portada + zonas).
 * Header tipográfico unificado con conversaciones y eventos:
 * `<PageIcon>` 44×44 + título 26/700/Fraunces/-0.6.
 *
 * Padding lateral 12px (`px-3`) consistente con el resto de zonas.
 */
export default async function PlaceHomePage({ params }: Props) {
  const { placeSlug } = await params
  const place = await loadPlaceBySlug(placeSlug)
  if (!place) notFound()

  return (
    <div className="px-3 py-6">
      <header className="flex items-center gap-3">
        <PageIcon emoji="🏠" />
        <h1 className="font-title text-[26px] font-bold tracking-[-0.6px] text-text">
          {place.name}
        </h1>
      </header>
      <p className="mt-3 text-sm text-muted">
        Portada del place. Placeholder — Fase 7 del roadmap.
      </p>
    </div>
  )
}
