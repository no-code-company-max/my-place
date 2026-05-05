'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import {
  CATEGORY_EMOJI_MAX_LENGTH,
  CATEGORY_EMOJI_MIN_LENGTH,
  CATEGORY_TITLE_MAX_LENGTH,
  CATEGORY_TITLE_MIN_LENGTH,
} from '@/features/library/public'
import type { WizardStepProps } from '@/shared/ui/wizard'
import type { CategoryFormValue } from './category-form-types'

// EmojiPickerInline trae Frimousse + el dataset de emojis (~40KB gz).
// Sólo se monta cuando el user tap-ea "elegir emoji" (`pickingEmoji=true`),
// así que lo cargamos diferido para sacarlo del first-load JS del wizard.
const EmojiPickerInline = dynamic(
  () => import('@/shared/ui/emoji-picker').then((m) => ({ default: m.EmojiPickerInline })),
  {
    ssr: false,
    loading: () => (
      <div
        className="h-72 w-full animate-pulse rounded-md bg-soft"
        aria-label="Cargando selector de emoji"
      />
    ),
  },
)

/**
 * Step 1 del wizard: identidad de la categoría (emoji + título).
 *
 * Emoji picker en mobile: push interno del BottomSheet (este componente
 * cubre el body completo cuando `pickingEmoji=true`, con header "← Volver"
 * que vuelve al form normal). Decisión #D11 ADR — el emoji picker
 * reemplaza el contenido del sheet en mobile, no abre nested sheet.
 *
 * Validación: emoji 1..8 chars Unicode + título trimmed entre 1..60.
 * Reporta `onValid(true)` cuando ambos pasan.
 */
export function CategoryFormStepIdentity({
  value,
  onChange,
  onValid,
}: WizardStepProps<CategoryFormValue>): React.ReactNode {
  const [pickingEmoji, setPickingEmoji] = useState(false)

  const trimmedTitle = value.title.trim()
  const emojiValid =
    value.emoji.length >= CATEGORY_EMOJI_MIN_LENGTH &&
    value.emoji.length <= CATEGORY_EMOJI_MAX_LENGTH
  const titleValid =
    trimmedTitle.length >= CATEGORY_TITLE_MIN_LENGTH &&
    trimmedTitle.length <= CATEGORY_TITLE_MAX_LENGTH

  useEffect(() => {
    onValid(emojiValid && titleValid)
  }, [emojiValid, titleValid, onValid])

  if (pickingEmoji) {
    return (
      <EmojiPickerInline
        value={value.emoji || null}
        onChange={(unicode) => {
          onChange({ ...value, emoji: unicode })
          setPickingEmoji(false)
        }}
        onClose={() => setPickingEmoji(false)}
      />
    )
  }

  return (
    <div className="space-y-4 py-2">
      <label className="block">
        <span className="mb-1 block text-sm text-neutral-600">Emoji</span>
        <button
          type="button"
          onClick={() => setPickingEmoji(true)}
          className="block min-h-[56px] w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-center text-3xl hover:border-neutral-500 focus:border-neutral-500 focus:outline-none"
          aria-label={
            value.emoji ? `Emoji actual: ${value.emoji}. Tap para cambiar.` : 'Elegir emoji'
          }
        >
          {value.emoji || <span className="text-base text-neutral-500">Tap para elegir</span>}
        </button>
      </label>

      <label className="block">
        <span className="mb-1 block text-sm text-neutral-600">Título</span>
        <input
          type="text"
          maxLength={CATEGORY_TITLE_MAX_LENGTH}
          placeholder="Recetas, Tutoriales, Recursos…"
          value={value.title}
          onChange={(e) => onChange({ ...value, title: e.target.value })}
          aria-invalid={!titleValid && value.title.length > 0 ? true : undefined}
          className="block min-h-[44px] w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-base focus:border-neutral-500 focus:outline-none"
        />
      </label>
    </div>
  )
}
