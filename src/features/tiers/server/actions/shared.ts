import 'server-only'
import { revalidatePath } from 'next/cache'

/**
 * Revalida `/settings/tiers` del place tras una mutación de tiers.
 *
 * v1 sólo hay una page que lista tiers (owner-only). Cuando llegue el
 * pricing page público, se sumará `/${placeSlug}` o lo que aplique.
 */
export function revalidateTiersPaths(placeSlug: string): void {
  revalidatePath(`/${placeSlug}/settings/tiers`)
}
