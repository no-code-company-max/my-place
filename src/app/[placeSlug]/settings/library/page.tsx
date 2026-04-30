import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { loadPlaceBySlug } from '@/shared/lib/place-loader'
import {
  CategoryFormDialog,
  CategoryListAdmin,
  MAX_CATEGORIES_PER_PLACE,
} from '@/features/library/public'
import { listLibraryCategories } from '@/features/library/public.server'

export const metadata: Metadata = {
  title: 'Biblioteca · Settings',
}

type Props = {
  params: Promise<{ placeSlug: string }>
}

/**
 * Settings de Biblioteca (R.7.3) — admin CRUD de categorías.
 *
 * Gate admin/owner heredado del layout `/settings/layout.tsx`. El page
 * lista categorías activas + ofrece "Nueva categoría" en el header.
 *
 * Editar y Archivar viven inline en cada row del `<CategoryListAdmin>`.
 * Reordering manual queda diferido a R.7.3.X (sin `@dnd-kit` todavía).
 *
 * Las archivadas NO se muestran en este listado v1 — admin que
 * quiera restaurar tiene que tocar DB. R.7.3.X+ podría sumar tab
 * "Archivadas" con botón restore.
 *
 * Ver `docs/features/library/spec.md` § 14.3.
 */
export default async function SettingsLibraryPage({ params }: Props) {
  const { placeSlug } = await params

  const place = await loadPlaceBySlug(placeSlug)
  if (!place || place.archivedAt) {
    notFound()
  }

  const categories = await listLibraryCategories(place.id)
  const remaining = MAX_CATEGORIES_PER_PLACE - categories.length
  const canCreateMore = remaining > 0

  return (
    <div className="space-y-6 p-4 md:p-8">
      <header>
        <p className="text-sm text-muted">Settings · {place.name}</p>
        <h1 className="font-serif text-3xl italic text-text">Biblioteca</h1>
        <p className="mt-2 text-sm text-muted">
          Las categorías agrupan los recursos de la biblioteca. Vos elegís el emoji, el título y
          quién puede agregar contenido en cada una.
        </p>
      </header>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-title text-base font-semibold text-text">
            Categorías ({categories.length}
            {canCreateMore ? ` de ${MAX_CATEGORIES_PER_PLACE}` : ' — máximo'})
          </h2>
          {canCreateMore ? (
            <CategoryFormDialog
              mode={{ kind: 'create', placeId: place.id }}
              trigger={
                <span className="rounded-md bg-accent px-3 py-1.5 text-sm text-bg">
                  Nueva categoría
                </span>
              }
            />
          ) : (
            <span className="text-xs text-muted">
              Llegaste al máximo. Archivá alguna para crear otra.
            </span>
          )}
        </div>

        <CategoryListAdmin categories={categories} />
      </section>
    </div>
  )
}
