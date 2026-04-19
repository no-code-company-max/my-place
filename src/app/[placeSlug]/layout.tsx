import { buildThemeVars, type ThemeConfig } from '@/shared/config/theme'

type Props = {
  children: React.ReactNode
  params: Promise<{ placeSlug: string }>
}

/**
 * Layout del place. Inyecta las CSS vars del tema configurado por el admin.
 *
 * En este scaffold no leemos de DB todavía — usamos el tema default.
 * Fase 2 (places) implementa el fetch real del `Place.themeConfig`.
 */
export default async function PlaceLayout({ children, params }: Props) {
  const { placeSlug } = await params
  // TODO(Fase 2): const place = await getPlaceBySlug(placeSlug); notFound si null.
  const themeConfig: ThemeConfig = {}
  void placeSlug

  return (
    <div style={buildThemeVars(themeConfig)} className="min-h-screen bg-place text-place-text">
      {children}
    </div>
  )
}
