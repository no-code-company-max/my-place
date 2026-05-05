'use client'

import { useEffect, useState } from 'react'

/**
 * Hook que retorna `'mobile' | 'desktop'` según el breakpoint.
 *
 * Threshold: ≥768px (`md:` de Tailwind) = desktop. Convención del
 * proyecto — alineado con `<BottomSheet>` y patrones de
 * `docs/ux-patterns.md` (mobile-first, validar a 360px).
 *
 * Uso típico: el consumer decide qué variant del emoji picker
 * renderizar (`<EmojiPickerInline>` para mobile push interno
 * del BottomSheet vs `<EmojiPickerPopover>` para desktop popover
 * anclado al trigger). Ver ADR 2026-05-04 § D11.
 *
 * SSR: durante el primer render server-side y antes de mount
 * client, devuelve `'mobile'` defensive (mobile-first). Cambia
 * al valor real en el primer effect.
 */
export function useResponsiveEmojiPicker(): 'mobile' | 'desktop' {
  const [mode, setMode] = useState<'mobile' | 'desktop'>('mobile')

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return
    }
    const mql = window.matchMedia('(min-width: 768px)')
    setMode(mql.matches ? 'desktop' : 'mobile')

    const listener = (e: MediaQueryListEvent) => {
      setMode(e.matches ? 'desktop' : 'mobile')
    }
    mql.addEventListener('change', listener)
    return () => {
      mql.removeEventListener('change', listener)
    }
  }, [])

  return mode
}
