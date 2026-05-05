import { vi } from 'vitest'

/**
 * Helpers compartidos por los tests de emoji-picker.
 *
 * Aislados acá porque inflaban el archivo principal de tests más allá
 * del cap de 300 LOC. Cubren tres polyfills/mocks que jsdom no provee
 * y que Frimousse necesita:
 *
 * 1. ResizeObserver (jsdom no lo trae nativo).
 * 2. fetch del CDN de Emojibase (mockeado con dataset mínimo en español).
 * 3. canvas 2d context (Frimousse mide soporte de emojis con `<canvas>`).
 * 4. matchMedia (para el hook `useResponsiveEmojiPicker`).
 */

/** ResizeObserver no-op para jsdom. */
export class ResizeObserverPolyfill {
  observe() {}
  unobserve() {}
  disconnect() {}
}

/** Dataset mínimo del CDN de Emojibase con strings en español. */
export const fakeMessages = {
  groups: [{ key: 'smileys-emotion', order: 0, message: 'caritas y emoción' }],
  subgroups: [{ key: 'face-smiling', order: 0, message: 'cara sonriente' }],
  skinTones: [
    { key: 'light', message: 'tono claro' },
    { key: 'medium-light', message: 'tono medio claro' },
    { key: 'medium', message: 'tono medio' },
    { key: 'medium-dark', message: 'tono medio oscuro' },
    { key: 'dark', message: 'tono oscuro' },
  ],
}

export const fakeData = [
  {
    emoji: '🔥',
    label: 'fuego',
    group: 0,
    subgroup: 0,
    version: 0.6,
    tags: ['fuego', 'llama'],
  },
  {
    emoji: '😀',
    label: 'cara sonriendo',
    group: 0,
    subgroup: 0,
    version: 1,
    tags: ['sonrisa', 'feliz'],
  },
  {
    emoji: '⭐',
    label: 'estrella',
    group: 0,
    subgroup: 0,
    version: 0.6,
    tags: ['estrella'],
  },
]

/**
 * Mockea `fetch` con respuestas válidas para Frimousse:
 * - HEAD requests devuelven etag.
 * - GET de `messages.json` y `data.json` devuelven los fakes en español.
 */
export function mockFrimousseFetch() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    const isHead = init?.method === 'HEAD'
    if (isHead) {
      return new Response(null, { headers: { etag: 'test-etag' } })
    }
    if (url.endsWith('/messages.json')) {
      return new Response(JSON.stringify(fakeMessages), {
        headers: { 'content-type': 'application/json', etag: 'test-etag' },
      })
    }
    if (url.endsWith('/data.json')) {
      return new Response(JSON.stringify(fakeData), {
        headers: { 'content-type': 'application/json', etag: 'test-etag' },
      })
    }
    return new Response('not found', { status: 404 })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

/**
 * Stub del 2d canvas context que Frimousse usa para detectar qué emojis
 * están soportados por el browser. Sin esto, `document.createElement
 * ('canvas').getContext('2d')` tira en jsdom y Frimousse asume que
 * NINGÚN emoji está soportado, ocultándolos todos.
 *
 * Hace que `getImageData` devuelva valores alternados entre frames
 * (255/0) para que la comparación rgb mismatch interna de Frimousse
 * (`t[r]!==o[r]`) considere todos los emojis "soportados".
 */
export function stubEmojiSupportCanvas() {
  let toggle = 0
  const fakeCtx = {
    canvas: { width: 0, height: 0 },
    font: '',
    textBaseline: '' as CanvasTextBaseline,
    fillStyle: '',
    measureText: () => ({ width: 1 }) as TextMetrics,
    fillText: () => {},
    clearRect: () => {},
    getImageData: () => {
      toggle = toggle === 0 ? 255 : 0
      return { data: new Uint8ClampedArray([toggle, 0, 0, 255]) } as ImageData
    },
  }
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => fakeCtx,
  ) as unknown as HTMLCanvasElement['getContext']
}

/** Stub de `window.matchMedia` para tests del hook responsive. */
export function stubMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}
