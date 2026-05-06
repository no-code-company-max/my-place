'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { prisma } from '@/db/client'
import { requireAuthUserId } from '@/shared/lib/auth-user'
import { findPlaceOwnership } from '@/shared/lib/identity-cache'
import { logger } from '@/shared/lib/logger'
import { editorPluginsConfigSchema } from '../domain/schemas'
import type { EditorPluginsConfig } from '../domain/types'
import { editorConfigCacheTag } from './queries'

/**
 * Resultado discriminado del action — la UI matchea contra `ok` para
 * elegir entre toast.success y toast.error con copy en español. Tirar
 * excepciones desde un Server Action invoca el error boundary y no le da
 * al consumer la chance de elegir feedback granular; preferimos el patrón
 * shape-result acá (mismo en `tiers/server/actions.ts`).
 */
export type UpdateEditorConfigResult =
  | { ok: true }
  | { ok: false; error: 'forbidden' | 'invalid' | 'not_found' }

export type UpdateEditorConfigInput = {
  placeId: string
  config: EditorPluginsConfig
}

/**
 * Persist de `Place.editorPluginsConfig`. Owner-only del place.
 *
 * - Valida shape estricto vía `editorPluginsConfigSchema`.
 * - Gate owner-only via `findPlaceOwnership` (cacheado por request).
 * - Update full-replace (no merge) — el shape es chico y la UI envía
 *   siempre el snapshot completo.
 * - Invalida `editor-config:{placeId}` para que próximos mounts de
 *   composer vean el nuevo config sin esperar el TTL 60s. También
 *   invalida la propia page de settings.
 *
 * Ver `docs/features/rich-text/spec.md` § "Feature flags por place".
 */
export async function updateEditorConfigAction(
  input: UpdateEditorConfigInput,
): Promise<UpdateEditorConfigResult> {
  const parsedConfig = editorPluginsConfigSchema.safeParse(input?.config)
  if (!parsedConfig.success || typeof input.placeId !== 'string' || input.placeId.length === 0) {
    return { ok: false, error: 'invalid' }
  }

  const actorId = await requireAuthUserId(
    'Necesitás iniciar sesión para editar la configuración del editor.',
  )

  const place = await prisma.place.findUnique({
    where: { id: input.placeId },
    select: { id: true, slug: true, archivedAt: true },
  })
  if (!place || place.archivedAt) {
    return { ok: false, error: 'not_found' }
  }

  const isOwner = await findPlaceOwnership(actorId, place.id)
  if (!isOwner) {
    return { ok: false, error: 'forbidden' }
  }

  await prisma.place.update({
    where: { id: place.id },
    data: { editorPluginsConfig: parsedConfig.data },
  })

  logger.info(
    {
      event: 'editorConfigUpdated',
      placeId: place.id,
      actorId,
      config: parsedConfig.data,
    },
    'editor config updated',
  )

  revalidateTag(editorConfigCacheTag(place.id))
  revalidatePath(`/${place.slug}/settings/editor`)

  return { ok: true }
}
