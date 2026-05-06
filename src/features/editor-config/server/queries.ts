import 'server-only'
import { unstable_cache } from 'next/cache'
import { prisma } from '@/db/client'
import { parseEditorPluginsConfig } from '../domain/schemas'
import type { EditorPluginsConfig } from '../domain/types'

/**
 * Tag base de invalidación. Cualquier persist en `updateEditorConfig`
 * llama `revalidateTag(editorConfigCacheTag(placeId))`. Centralizado para
 * evitar drift entre el productor del tag y los consumers.
 */
export function editorConfigCacheTag(placeId: string): string {
  return `editor-config:${placeId}`
}

/**
 * Lee `Place.editorPluginsConfig` y lo pasa por `parseEditorPluginsConfig`
 * (defensivo, ver schemas.ts). Cacheado con `unstable_cache` por
 * `placeId` + tag granular — la cache hit ratio importa porque cada
 * mount de composer en una page lee este config.
 *
 * `revalidate: 60s` es fallback; el path canónico de invalidación es el
 * `revalidateTag` que dispara `updateEditorConfigAction` post-update.
 *
 * Patrón heredado de `findInviterPermissions` (Sesión 2.3 perf).
 */
export async function getEditorConfigForPlace(placeId: string): Promise<EditorPluginsConfig> {
  const load = unstable_cache(
    async () => {
      const row = await prisma.place.findUnique({
        where: { id: placeId },
        select: { editorPluginsConfig: true },
      })
      return parseEditorPluginsConfig(row?.editorPluginsConfig ?? null)
    },
    ['editor-config', placeId],
    { tags: [editorConfigCacheTag(placeId)], revalidate: 60 },
  )
  return load()
}
