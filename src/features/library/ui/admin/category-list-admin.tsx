import Link from 'next/link'
import type { LibraryCategory, WriteAccessKind } from '@/features/library/public'

type Props = {
  /** Categorías activas (no archivadas) — el listado del admin (master pane). */
  categories: ReadonlyArray<LibraryCategory>
}

/**
 * Master pane: listado de categorías como rows tappables que navegan al
 * detail page `/settings/library/[categoryId]`. Las acciones (Editar,
 * Archivar) viven en el detail page — esta master list solo es navegación.
 *
 * **Refactor S1b (2026-05-13):** removido prop `contributorsByCategory`
 * + label de contribution policy legacy. La chip de acceso de escritura
 * ahora muestra el label del `writeAccessKind`. S3 reformatea el row con
 * chips read + write definitivas.
 */
export function CategoryListAdmin({ categories }: Props): React.ReactNode {
  if (categories.length === 0) {
    return (
      <div className="rounded-md border border-neutral-200 bg-neutral-50 p-6 text-sm italic text-neutral-500">
        Todavía no hay categorías. Creá la primera para empezar a organizar la biblioteca.
      </div>
    )
  }

  return (
    <ul className="divide-y divide-neutral-200 border-y border-neutral-200">
      {categories.map((category) => (
        <li key={category.id}>
          <Link
            href={`/settings/library/${category.id}`}
            className="flex min-h-[56px] items-center gap-3 px-3 py-3 hover:bg-neutral-50"
          >
            <span aria-hidden className="text-2xl leading-none">
              {category.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="truncate font-serif text-base">{category.title}</h3>
              <p className="truncate text-xs text-neutral-600">
                <span>/library/{category.slug}</span>
                <span className="mx-1.5">·</span>
                <span>{writeAccessLabel(category.writeAccessKind)}</span>
              </p>
            </div>
            <span aria-hidden="true" className="shrink-0 text-neutral-400">
              ›
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

function writeAccessLabel(kind: WriteAccessKind): string {
  switch (kind) {
    case 'OWNER_ONLY':
      return 'Solo owner escribe'
    case 'GROUPS':
      return 'Grupos seleccionados'
    case 'TIERS':
      return 'Tiers seleccionados'
    case 'USERS':
      return 'Usuarios seleccionados'
  }
}
