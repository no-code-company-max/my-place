import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

import {
  ResizeObserverPolyfill,
  mockFrimousseFetch,
  stubEmojiSupportCanvas,
  stubMatchMedia,
} from './test-helpers'

/**
 * Tests del wrapper genérico de emoji picker (Frimousse).
 *
 * Decisiones cubiertas (ADR 2026-05-04 § D10/D11):
 * - locale="es" (search en español).
 * - Skin tones OFF (no se renderiza el selector).
 * - Native unicode (no Twemoji images).
 * - Variant Inline (push interno mobile) y Popover (desktop).
 * - onClose opcional para botón "← Volver" del Inline.
 *
 * Frimousse fetchea data del CDN al montar — los tests mockean `fetch`
 * con dataset mínimo en español (ver `./test-helpers.ts`).
 */

// React 19 + RTL requiere flag explícito para que `act()` funcione.
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
;(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= ResizeObserverPolyfill

beforeEach(() => {
  // Limpia caches de Frimousse entre tests.
  localStorage.clear()
  sessionStorage.clear()
  mockFrimousseFetch()
  stubEmojiSupportCanvas()
  stubMatchMedia(false) // default mobile
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

/** Espera a que Frimousse termine de fetchear y procesar el dataset. */
async function waitForEmojisLoaded() {
  await waitFor(
    () => {
      expect(screen.queryByText('Cargando emojis…')).not.toBeInTheDocument()
    },
    { timeout: 3000 },
  )
}

/**
 * Filtra los `[frimousse-emoji]` del DOM excluyendo el sizer oculto
 * (Frimousse renderiza emojis dummy con `aria-hidden=true` y
 * `visibility:hidden` para medir alturas — los excluimos).
 */
function getVisibleEmojiLabels(): string[] {
  const all = Array.from(document.querySelectorAll('[frimousse-emoji]'))
  const visible = all.filter((el) => {
    let cur: HTMLElement | null = el as HTMLElement
    while (cur) {
      if (cur.getAttribute('aria-hidden') === 'true') return false
      if (cur.style?.visibility === 'hidden') return false
      cur = cur.parentElement
    }
    return true
  })
  return visible.map((el) => el.getAttribute('aria-label') ?? '')
}

describe('<EmojiPickerInline>', () => {
  it('renderiza el search input con placeholder en español', async () => {
    const { EmojiPickerInline } = await import('../emoji-picker-inline')
    render(<EmojiPickerInline value={null} onChange={() => {}} />)
    const search = screen.getByPlaceholderText(/buscar/i)
    expect(search).toBeInTheDocument()
    expect(search.tagName).toBe('INPUT')
  })

  it('NO renderiza skin tone selector', async () => {
    const { EmojiPickerInline } = await import('../emoji-picker-inline')
    render(<EmojiPickerInline value={null} onChange={() => {}} />)
    await waitForEmojisLoaded()
    expect(document.querySelector('[frimousse-skin-tone-selector]')).toBeNull()
  })

  it('busca por label en español y filtra al match', async () => {
    const { EmojiPickerInline } = await import('../emoji-picker-inline')
    render(<EmojiPickerInline value={null} onChange={() => {}} />)
    await waitForEmojisLoaded()

    // Frimousse capitaliza los labels al renderizar (ver `Z()` en
    // node_modules/frimousse/dist/index.js).
    const search = screen.getByPlaceholderText(/buscar/i) as HTMLInputElement
    await act(async () => {
      fireEvent.change(search, { target: { value: 'fuego' } })
    })

    // Frimousse procesa el filter via `requestIdleCallback` (fallback
    // setTimeout 10ms) + `useDeferredValue`. Esperamos a que sólo
    // quede Fuego visible — los otros 2 salen del dataset filtrado.
    await waitFor(
      () => {
        expect(getVisibleEmojiLabels()).toEqual(['Fuego'])
      },
      { timeout: 3000 },
    )
  })

  it('click en un emoji dispara onChange con el unicode', async () => {
    const { EmojiPickerInline } = await import('../emoji-picker-inline')
    const onChange = vi.fn()
    render(<EmojiPickerInline value={null} onChange={onChange} />)
    await waitForEmojisLoaded()

    await waitFor(
      () => {
        expect(document.querySelector('[aria-label="Fuego"]')).not.toBeNull()
      },
      { timeout: 3000 },
    )

    const fuegoButton = document.querySelector('[aria-label="Fuego"]') as HTMLButtonElement
    await act(async () => {
      fuegoButton.click()
    })

    expect(onChange).toHaveBeenCalledWith('🔥')
  })

  it('header con título y botón "← Volver" cuando onClose se provee', async () => {
    const { EmojiPickerInline } = await import('../emoji-picker-inline')
    const onClose = vi.fn()
    render(<EmojiPickerInline value={null} onChange={() => {}} onClose={onClose} />)

    expect(screen.getByText(/elegí un emoji/i)).toBeInTheDocument()
    const back = screen.getByRole('button', { name: /volver/i })
    expect(back).toBeInTheDocument()

    await act(async () => {
      back.click()
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('NO renderiza header cuando onClose es undefined', async () => {
    const { EmojiPickerInline } = await import('../emoji-picker-inline')
    render(<EmojiPickerInline value={null} onChange={() => {}} />)
    expect(screen.queryByText(/elegí un emoji/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /volver/i })).not.toBeInTheDocument()
  })
})

describe('<EmojiPickerPopover>', () => {
  it('abre el contenido al click del trigger', async () => {
    const { EmojiPickerPopover } = await import('../emoji-picker-popover')
    render(
      <EmojiPickerPopover value={null} onChange={() => {}}>
        <button type="button">📚</button>
      </EmojiPickerPopover>,
    )

    // Cerrado por defecto: el search del picker no está montado.
    expect(screen.queryByPlaceholderText(/buscar/i)).not.toBeInTheDocument()

    const trigger = screen.getByRole('button', { name: '📚' })
    await act(async () => {
      trigger.click()
    })

    // Abierto: el search aparece (Radix portala al body).
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/buscar/i)).toBeInTheDocument()
    })
  })
})

describe('useResponsiveEmojiPicker', () => {
  it('retorna "mobile" cuando matchMedia(min-width: 768px) es false', async () => {
    stubMatchMedia(false)
    const { renderHook } = await import('@testing-library/react')
    const { useResponsiveEmojiPicker } = await import('../use-responsive-emoji-picker')
    const { result } = renderHook(() => useResponsiveEmojiPicker())
    expect(result.current).toBe('mobile')
  })

  it('retorna "desktop" cuando matchMedia(min-width: 768px) es true', async () => {
    stubMatchMedia(true)
    const { renderHook } = await import('@testing-library/react')
    const { useResponsiveEmojiPicker } = await import('../use-responsive-emoji-picker')
    const { result } = renderHook(() => useResponsiveEmojiPicker())
    expect(result.current).toBe('desktop')
  })
})
