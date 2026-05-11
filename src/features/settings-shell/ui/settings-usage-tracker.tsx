'use client'

import { useEffect } from 'react'
import { trackSettingsUsage } from '../lib/track-settings-usage'

/**
 * Client Component invisible que registra un increment en `localStorage` cada
 * vez que el `currentPath` cambia (= cada navegación dentro de `/settings/*`).
 * Alimenta el `<FrequentlyAccessedHub>` mobile.
 *
 * Se monta UNA vez en el `<SettingsShell>` (server). El `currentPath` viene
 * del header `x-pathname`. Cuando Next reusa el layout entre rutas hermanas,
 * el `currentPath` cambia → useEffect dispara → track.
 *
 * Render `null` (no UI propia).
 */
type Props = {
  currentPath: string
}

export function SettingsUsageTracker({ currentPath }: Props): null {
  useEffect(() => {
    trackSettingsUsage(currentPath)
  }, [currentPath])
  return null
}
