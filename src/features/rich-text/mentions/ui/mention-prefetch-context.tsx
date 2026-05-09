'use client'

import { createContext, useContext } from 'react'
import type {
  MentionEventResult,
  MentionLibraryCategoryResult,
  MentionUserResult,
} from './mention-types'

/**
 * Cache prefetcheado de los 3 listados base que el `MentionPlugin` muestra
 * con query vacía (`@`, `/event`, `/library`). Un Provider externo (vive en
 * `discussions/composers/mention-prefetch-provider.tsx`) lo popula en
 * background mientras el viewer navega el shell, así que cuando abre un
 * composer y dispara el trigger, el menú aparece instant — sin RTT live.
 *
 * `null` semánticamente significa "el prefetch aún no terminó (o no existe
 * Provider)". El plugin distingue eso de `[]` (lista vacía legítima) y cae
 * a su propio prefetch + fetch live como fallback defensivo.
 *
 * `searchLibraryItems` NO se prefetchea — depende de `categorySlug` runtime.
 *
 * Ver `docs/plans/2026-05-09-mention-prefetch-background.md` § D3.
 */
export type MentionPrefetchValue = {
  users: MentionUserResult[] | null
  events: MentionEventResult[] | null
  categories: MentionLibraryCategoryResult[] | null
  /** Fuerza refresh manual. Rara vez usado — los timers + visibility cubren el 99%. */
  refresh: () => Promise<void>
  /** Epoch ms del último fetch exitoso. `null` si aún no terminó el primer prefetch. */
  lastFetchedAt: number | null
}

/**
 * Context vive en `rich-text/mentions/` porque el consumer (`MentionPlugin`)
 * está acá. NO mover a `discussions/`: violaría el boundary
 * `rich-text/` ↛ `discussions/` (architecture.md § Reglas de aislamiento).
 *
 * Default `null` permite que el plugin renderice fuera de un Provider
 * (tests isolated, futuras pages sin shell). El hook lo retorna sin throw.
 */
export const MentionPrefetchContext = createContext<MentionPrefetchValue | null>(null)

/**
 * Hook consumer. Retorna `null` si no hay Provider arriba en el árbol —
 * el plugin tolera `null` y cae al comportamiento legacy (prefetch propio
 * + fetch live).
 */
export function useMentionPrefetchSource(): MentionPrefetchValue | null {
  return useContext(MentionPrefetchContext)
}
