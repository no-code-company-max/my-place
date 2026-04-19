type Props = { params: Promise<{ placeSlug: string }> }

/**
 * Settings del place. Solo admins. Placeholder hasta Fase 2/4.
 */
export default async function PlaceSettingsPage({ params }: Props) {
  const { placeSlug } = await params
  return (
    <main className="p-8">
      <h1 className="font-serif text-2xl italic">Settings · {placeSlug}</h1>
      <p className="mt-2 text-place-text-soft">
        Configuración del place (solo admins). Placeholder.
      </p>
    </main>
  )
}
