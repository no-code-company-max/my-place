'use client'

import { useEffect, useState } from 'react'

/**
 * Indicador de progreso top discreto para navegaciones que demoran.
 * Reemplaza al `loading.tsx` skeleton cuando el caller envuelve la
 * navegación con `startTransition` y mantiene el UI viejo visible.
 *
 * Diseño anti-flicker: no renderea inmediatamente cuando `isPending`
 * pasa a true. Espera `delayMs` (default 200ms) — si la transition
 * resuelve antes (cache hit warm, navegación instant), nunca aparece.
 *
 * Cuando aparece: barra 2px del color accent, fade-in 150ms. Al
 * terminar la transition (`isPending` → false), fade-out 150ms.
 *
 * Vive en `shared/ui/` como primitivo agnóstico — cualquier feature
 * puede usarlo. Primer caller: `<ZoneSwiper>` en el shell (R.2.5).
 *
 * Ver `docs/features/shell/spec.md` § 16.4 (eliminación del skeleton).
 */
type Props = {
  isPending: boolean
  delayMs?: number
}

export function TopProgressBar({ isPending, delayMs = 200 }: Props): React.ReactNode {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!isPending) {
      setVisible(false)
      return
    }
    const timer = setTimeout(() => setVisible(true), delayMs)
    return () => clearTimeout(timer)
  }, [isPending, delayMs])

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-x-0 top-0 z-50 h-[2px] bg-accent motion-safe:transition-opacity ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      style={{ transitionDuration: '150ms' }}
    />
  )
}
