/**
 * Wrapper genérico del emoji picker (Frimousse) para Place.
 *
 * Surface pública:
 * - `<EmojiPickerInline>` — render full-width inline. Mobile push
 *   interno del BottomSheet. Header opcional con "← Volver".
 * - `<EmojiPickerPopover>` — wrapper Radix Popover. Desktop, anclado
 *   al trigger pasado como children.
 * - `useResponsiveEmojiPicker()` — helper hook que retorna
 *   `'mobile' | 'desktop'` según `(min-width: 768px)` matchMedia.
 *
 * El consumer decide la variant según breakpoint. Ambas variants
 * comparten config (locale="es", skin tones OFF, native unicode).
 *
 * Ver ADR `docs/decisions/2026-05-04-library-courses-and-read-access.md`
 * § D10/D11 para la motivación.
 */

export { EmojiPickerInline } from './emoji-picker-inline'
export type { EmojiPickerInlineProps } from './emoji-picker-inline'

export { EmojiPickerPopover } from './emoji-picker-popover'
export type { EmojiPickerPopoverProps } from './emoji-picker-popover'

export { useResponsiveEmojiPicker } from './use-responsive-emoji-picker'
