'use client'

import * as RadixPopover from '@radix-ui/react-popover'
import { useState, type ReactNode } from 'react'

import { EmojiPickerInline } from './emoji-picker-inline'

/**
 * Wrapper genérico del emoji picker (Frimousse) en variant popover.
 *
 * Pensado para desktop (≥768px) — anclado al trigger (`children`),
 * width fija ~320px, height ~360px. Usa Radix Popover para gestionar
 * focus trap, ESC, click outside, return-focus al trigger.
 *
 * El consumer pasa el trigger como children (un `<button>` típicamente
 * con el emoji actual o un placeholder). El popover se abre al click
 * y se cierra al elegir emoji o al ESC / click outside.
 *
 * Decisiones (ADR 2026-05-04 § D11): desktop = popover anclado.
 * Mobile = `<EmojiPickerInline>` directamente en push interno del
 * BottomSheet — no se usa este wrapper en mobile.
 */
export interface EmojiPickerPopoverProps {
  /**
   * Emoji actualmente seleccionado, o `null` si ninguno. Pasado al
   * `<EmojiPickerInline>` interno por consistencia de API.
   */
  value: string | null
  /**
   * Callback invocado al seleccionar un emoji. Recibe el unicode.
   * El popover se cierra automáticamente tras la selección — el
   * consumer no necesita manejar el cierre.
   */
  onChange: (emoji: string) => void
  /**
   * Trigger del popover. Típicamente un `<button>` con el emoji
   * actual visible. Radix wrappea con `asChild` semantics — pasar
   * un único elemento focuseable.
   */
  children: ReactNode
  /**
   * Lado del trigger donde se ancla. Default: `'bottom'`.
   */
  side?: 'top' | 'right' | 'bottom' | 'left'
  /**
   * Alineación al trigger. Default: `'start'`.
   */
  align?: 'start' | 'center' | 'end'
}

export function EmojiPickerPopover({
  value,
  onChange,
  children,
  side = 'bottom',
  align = 'start',
}: EmojiPickerPopoverProps): ReactNode {
  const [open, setOpen] = useState(false)

  const handleChange = (emoji: string) => {
    onChange(emoji)
    setOpen(false)
  }

  return (
    <RadixPopover.Root open={open} onOpenChange={setOpen}>
      <RadixPopover.Trigger asChild>{children}</RadixPopover.Trigger>
      <RadixPopover.Portal>
        <RadixPopover.Content
          side={side}
          align={align}
          sideOffset={6}
          className="z-50 w-[320px] rounded-md border border-neutral-300 bg-white p-3 shadow-lg outline-none"
        >
          <EmojiPickerInline value={value} onChange={handleChange} autoFocusSearch />
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  )
}
