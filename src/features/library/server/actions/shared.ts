import 'server-only'
import { revalidatePath } from 'next/cache'

/**
 * Revalida las rutas afectadas por un cambio sobre una categoría o
 * item. Mismo patrón que `events/server/actions/shared.ts`.
 *
 * Next cachea por path exacto, así que cada bucket
 * (`/library`, `/library/[slug]`, `/settings/library`) debe listarse
 * explícitamente.
 */
export function revalidateLibraryCategoryPaths(placeSlug: string, categorySlug?: string): void {
  revalidatePath(`/${placeSlug}/library`)
  revalidatePath(`/${placeSlug}/settings/library`)
  if (categorySlug) {
    revalidatePath(`/${placeSlug}/library/${categorySlug}`)
  }
}

/**
 * Revalida paths que tocan un item específico: zona biblioteca
 * (Recientes), categoría (listado), item detail, thread cross-zona
 * en /conversations.
 */
export function revalidateLibraryItemPaths(
  placeSlug: string,
  categorySlug: string,
  postSlug: string,
): void {
  revalidatePath(`/${placeSlug}/library`)
  revalidatePath(`/${placeSlug}/library/${categorySlug}`)
  revalidatePath(`/${placeSlug}/library/${categorySlug}/${postSlug}`)
  revalidatePath(`/${placeSlug}/conversations`)
  revalidatePath(`/${placeSlug}/conversations/${postSlug}`)
}
