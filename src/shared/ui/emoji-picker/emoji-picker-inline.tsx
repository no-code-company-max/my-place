'use client'

import { EmojiPicker, type EmojiPickerListEmojiProps } from 'frimousse'
import type { ReactNode } from 'react'

/**
 * Wrapper genérico del emoji picker (Frimousse) en variant inline.
 *
 * Render directo full-width pensado para el push interno del
 * `<BottomSheet>` en mobile. El consumer es responsable de meter este
 * componente dentro del sheet — el wrapper sólo renderiza el picker.
 *
 * Decisiones (ADR 2026-05-04 § D10/D11):
 * - `locale="es"` — search en español (Emojibase CDN data).
 * - Skin tones OFF — no renderizamos `<EmojiPicker.SkinToneSelector>`.
 *   Categoría es elección institucional, no personal.
 * - Native unicode glyphs — sin Twemoji images. Alineado con
 *   "nada parpadea" (no images cargando).
 * - Recents OFF — Frimousse no los trae built-in y no agregamos
 *   localStorage en MVP. Anti-feed.
 * - Default category al abrir: "Smileys & People" (Frimousse default).
 *
 * El componente es REUSABLE en cualquier parte del proyecto. No sabe
 * de library, ni de wizard, ni de form. Recibe `value` + `onChange`.
 *
 * Header opcional: si `onClose` se provee, se renderiza un header
 * sticky con título "Elegí un emoji" + botón "← Volver" que invoca
 * `onClose`. Pensado para el push interno del sheet, donde el flow
 * es: click trigger → push picker → user elige o vuelve.
 */
export interface EmojiPickerInlineProps {
  /**
   * Emoji actualmente seleccionado, o `null` si ninguno.
   * Se pasa por contrato — el wrapper no muestra preview activo
   * (Frimousse maneja `[data-active]` internamente, pero no
   * persistimos selección visual del último elegido).
   */
  value: string | null
  /**
   * Callback invocado al seleccionar un emoji. Recibe el unicode
   * (string) — el consumer guarda el unicode en su state.
   */
  onChange: (emoji: string) => void
  /**
   * Si se provee, se renderiza header sticky con botón "← Volver".
   * Útil para el push interno del BottomSheet en mobile.
   */
  onClose?: () => void
  /**
   * Autofoco en el input de búsqueda al montar. Útil cuando el
   * picker abre en respuesta a una acción explícita del user
   * (push del sheet, click del trigger). Default: false.
   */
  autoFocusSearch?: boolean
}

export function EmojiPickerInline({
  value,
  onChange,
  onClose,
  autoFocusSearch = false,
}: EmojiPickerInlineProps): ReactNode {
  // Suprimimos warning de prop no usada — `value` es parte del contrato
  // controlled aunque Frimousse no acepte un selectedEmoji prop. Lo
  // mantenemos en la API por consistencia con el variant Popover y por
  // si en el futuro Frimousse expone selección persistente.
  void value

  return (
    <div className="flex flex-col gap-3" frimousse-root-wrapper="">
      {onClose ? (
        <header className="flex items-center justify-between gap-3 border-b border-neutral-200 pb-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 min-w-11 items-center gap-1 rounded-md px-2 text-sm text-neutral-600 hover:bg-neutral-100"
            aria-label="Volver"
          >
            <span aria-hidden>←</span>
            <span>Volver</span>
          </button>
          <h2 className="font-serif text-lg text-neutral-900">Elegí un emoji</h2>
          {/* Spacer para balancear el header (botón izq + título centrado) */}
          <span aria-hidden className="min-w-11" />
        </header>
      ) : null}

      <EmojiPicker.Root
        locale="es"
        skinTone="none"
        columns={8}
        onEmojiSelect={({ emoji }) => onChange(emoji)}
        className="flex h-[360px] w-full flex-col"
      >
        <div className="px-1">
          <EmojiPicker.Search
            placeholder="Buscar emojis…"
            autoFocus={autoFocusSearch}
            className="block min-h-[44px] w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-base text-neutral-900 placeholder:text-neutral-500 focus:border-neutral-500 focus:outline-none"
          />
        </div>
        <EmojiPicker.Viewport className="flex-1 overflow-y-auto">
          <EmojiPicker.Loading className="flex h-full items-center justify-center text-sm text-neutral-500">
            Cargando emojis…
          </EmojiPicker.Loading>
          <EmojiPicker.Empty className="flex h-full items-center justify-center text-sm text-neutral-500">
            {({ search }) => <>Sin resultados para &ldquo;{search}&rdquo;</>}
          </EmojiPicker.Empty>
          <EmojiPicker.List
            components={{
              CategoryHeader: ({ category, ...props }) => (
                <div
                  {...props}
                  className="bg-white px-2 py-1 text-xs font-medium uppercase tracking-wide text-neutral-500"
                >
                  {category.label}
                </div>
              ),
              Row: ({ children, ...props }) => (
                <div {...props} className="flex">
                  {children}
                </div>
              ),
              Emoji: EmojiButton,
            }}
          />
        </EmojiPicker.Viewport>
      </EmojiPicker.Root>
    </div>
  )
}

/**
 * Botón individual de emoji. Tap target ≥44px (`min-h-11 min-w-11`)
 * cumple Apple HIG / Material baseline. `[data-active]` lo provee
 * Frimousse para hover/keyboard nav — lo usamos para destacar.
 */
function EmojiButton({ emoji, ...props }: EmojiPickerListEmojiProps) {
  return (
    <button
      type="button"
      {...props}
      className="flex min-h-11 min-w-11 flex-1 items-center justify-center rounded-md text-xl hover:bg-neutral-100 data-[active]:bg-neutral-100"
    >
      {emoji.emoji}
    </button>
  )
}
