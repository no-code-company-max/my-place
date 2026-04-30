import type { LibraryCategory } from '@/features/library/public'
import { ArchiveCategoryButton } from './archive-category-button'
import { CategoryFormDialog } from './category-form-dialog'
import { contributionPolicyLabel } from './contribution-policy-label'

type Props = {
  /** Categorías activas (no archivadas) — el listado del admin. */
  categories: ReadonlyArray<LibraryCategory>
}

/**
 * Listado admin de categorías. Server Component que renderiza una row
 * por categoría con: emoji, título, slug, policy label, botón Editar
 * (abre `<CategoryFormDialog mode="edit">`) y Archivar (abre confirm).
 *
 * Empty state minimal — el page padre decide si mostrar este componente
 * o un placeholder de "todavía no creaste ninguna" (la copy varía
 * según haya o no haya archivadas).
 */
export function CategoryListAdmin({ categories }: Props): React.ReactNode {
  if (categories.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-6 text-sm italic text-muted">
        Todavía no hay categorías. Creá la primera para empezar a organizar la biblioteca.
      </div>
    )
  }

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
      {categories.map((category) => (
        <li key={category.id} className="flex items-center gap-3 px-4 py-3">
          <span aria-hidden className="text-2xl leading-none">
            {category.emoji}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-title text-base font-semibold text-text">
              {category.title}
            </h3>
            <p className="truncate text-xs text-muted">
              <span>/library/{category.slug}</span>
              <span className="mx-1.5">·</span>
              <span>{contributionPolicyLabel(category.contributionPolicy)}</span>
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <CategoryFormDialog
              mode={{
                kind: 'edit',
                categoryId: category.id,
                initialEmoji: category.emoji,
                initialTitle: category.title,
                initialPolicy: category.contributionPolicy,
              }}
              trigger={
                <span className="rounded-md border border-border px-2.5 py-1.5 text-xs text-muted hover:text-text">
                  Editar
                </span>
              }
            />
            <ArchiveCategoryButton categoryId={category.id} categoryTitle={category.title} />
          </div>
        </li>
      ))}
    </ul>
  )
}
