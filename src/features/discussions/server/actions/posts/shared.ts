import 'server-only'
import { revalidatePath } from 'next/cache'

/**
 * Revalida las rutas afectadas por un cambio sobre un post específico.
 * Next.js cachea por path exacto, así que cada bucket (`/`, `/conversations`,
 * `/conversations/{slug}`) debe listarse explícitamente.
 *
 * NO es un server action (no `'use server'` en este archivo): es un helper
 * server-only consumido por los action files del directorio. Los actions
 * mantienen su propio `'use server'` al tope.
 */
export function revalidatePostPaths(placeSlug: string, postSlug?: string): void {
  revalidatePath(`/${placeSlug}`)
  revalidatePath(`/${placeSlug}/conversations`)
  if (postSlug) revalidatePath(`/${placeSlug}/conversations/${postSlug}`)
}
