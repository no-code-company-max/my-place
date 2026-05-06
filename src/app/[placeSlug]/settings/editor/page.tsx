import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getCurrentAuthUser } from '@/shared/lib/auth-user'
import { findPlaceOwnership } from '@/shared/lib/identity-cache'
import { loadPlaceBySlug } from '@/shared/lib/place-loader'
import { getEditorConfigForPlace } from '@/features/editor-config/public.server'
import { EditorConfigForm } from '@/features/editor-config/public'
import { PageHeader } from '@/shared/ui/page-header'

export const metadata: Metadata = {
  title: 'Editor · Settings',
}

type Props = { params: Promise<{ placeSlug: string }> }

/**
 * F.5 — Page de configuración del editor por place. Owner-only: el
 * settings layout ya gateó a admin/owner; acá restringimos a owner
 * porque desactivar embeds afecta el catálogo de funcionalidades del
 * editor para todo el place — decisión de plataforma, no operativa.
 *
 * Form orchestrator vive en `<EditorConfigForm>` (Client Component
 * con autosave + soft barrier). Acá sólo cargamos el config inicial
 * + gate.
 *
 * Ver `docs/features/rich-text/spec.md` § "Feature flags por place"
 * + `docs/ux-patterns.md`.
 */
export default async function SettingsEditorPage({ params }: Props) {
  const { placeSlug } = await params

  const auth = await getCurrentAuthUser()
  if (!auth) redirect(`/login?next=/settings/editor`)

  const place = await loadPlaceBySlug(placeSlug)
  if (!place || place.archivedAt) notFound()

  const isOwner = await findPlaceOwnership(auth.id, place.id)
  if (!isOwner) notFound()

  const config = await getEditorConfigForPlace(place.id)

  return (
    <div className="space-y-6 px-3 py-6 md:px-4 md:py-8">
      <PageHeader
        title="Editor"
        description="Plugins habilitados al crear contenido nuevo en este place."
      />

      <section aria-labelledby="embeds" className="space-y-4">
        <h2
          id="embeds"
          className="border-b pb-2 font-serif text-xl"
          style={{ borderColor: 'var(--border)' }}
        >
          Embeds permitidos
        </h2>
        <p className="text-sm text-neutral-600">
          Desactivar un embed lo oculta del composer al crear contenido nuevo. El contenido
          existente que ya use ese embed sigue mostrándose normal.
        </p>
        <EditorConfigForm placeId={place.id} initial={config} />
      </section>
    </div>
  )
}
