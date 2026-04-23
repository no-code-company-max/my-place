import 'server-only'
import { revalidatePath } from 'next/cache'

/**
 * Revalida las rutas afectadas por un cambio sobre un comment. El thread del
 * post padre (`/conversations/{postSlug}`) es la más importante; el listado
 * y la landing del place se actualizan para reflejar `lastActivityAt`
 * (rankings dormido/vivo).
 *
 * Helper server-only (sin `'use server'`) consumido por los action files del
 * directorio.
 */
export function revalidateCommentPaths(placeSlug: string, postSlug: string): void {
  revalidatePath(`/${placeSlug}`)
  revalidatePath(`/${placeSlug}/conversations`)
  revalidatePath(`/${placeSlug}/conversations/${postSlug}`)
}
