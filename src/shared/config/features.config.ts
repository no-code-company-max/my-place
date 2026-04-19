/**
 * Registry central de features. Ver `docs/feature-flags.md`.
 *
 * Reglas:
 * - CORE_FEATURES están siempre activas (apagarlas no tiene sentido ontológico).
 * - OPTIONAL_FEATURES se encienden/apagan por place.
 * - `library` está en el registry pero el MVP la muestra como "Próximamente".
 */

export const CORE_FEATURES = ['members'] as const
export const OPTIONAL_FEATURES = ['conversations', 'events', 'library'] as const

export type CoreFeatureId = (typeof CORE_FEATURES)[number]
export type OptionalFeatureId = (typeof OPTIONAL_FEATURES)[number]
export type FeatureId = CoreFeatureId | OptionalFeatureId

type FeatureManifest = {
  id: FeatureId
  required: boolean
  zone: { order: number; component: string } | null
  widget: string
  mvp: boolean // si es false, settings debe mostrar "Próximamente"
}

export const FEATURE_REGISTRY: Record<FeatureId, FeatureManifest> = {
  members: {
    id: 'members',
    required: true,
    zone: null, // members no es zona propia — vive en presencia + perfiles contextuales
    widget: 'MembersWidget',
    mvp: true,
  },
  conversations: {
    id: 'conversations',
    required: false,
    zone: { order: 1, component: 'ConversationsZone' },
    widget: 'ConversationWidget',
    mvp: true,
  },
  events: {
    id: 'events',
    required: false,
    zone: { order: 2, component: 'EventsZone' },
    widget: 'EventWidget',
    mvp: true,
  },
  library: {
    id: 'library',
    required: false,
    zone: { order: 3, component: 'LibraryZone' },
    widget: 'LibraryWidget',
    mvp: false, // "Próximamente" hasta que se implemente (roadmap.md)
  },
}

export const ALL_FEATURE_IDS = [...CORE_FEATURES, ...OPTIONAL_FEATURES] as const

/** Place-like parcial: lo único que necesitamos es el array de features habilitadas. */
type PlaceFeatureConfig = { enabledFeatures: readonly string[] }

export function isFeatureEnabled(place: PlaceFeatureConfig, featureId: FeatureId): boolean {
  const manifest = FEATURE_REGISTRY[featureId]
  if (manifest.required) return true
  return place.enabledFeatures.includes(featureId)
}

/** Zonas habilitadas en orden de render (swipe horizontal). */
export function enabledZones(place: PlaceFeatureConfig) {
  return ALL_FEATURE_IDS.map((id) => FEATURE_REGISTRY[id])
    .filter((m) => m.zone !== null)
    .filter((m) => isFeatureEnabled(place, m.id))
    .sort((a, b) => (a.zone?.order ?? 0) - (b.zone?.order ?? 0))
}
