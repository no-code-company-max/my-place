import { describe, it, expect, vi } from 'vitest'

// Mock del clientEnv para tener valor estable. El helper lee
// `clientEnv.NEXT_PUBLIC_APP_URL`.
vi.mock('@/shared/config/env', () => ({
  clientEnv: { NEXT_PUBLIC_APP_URL: 'https://app.place.community' },
}))

import { authCallbackUrlForNext } from '../auth-callback-url'

describe('authCallbackUrlForNext', () => {
  it('construye URL del callback con next URL-encoded', () => {
    const url = authCallbackUrlForNext('/invite/accept/tok_abc123')
    expect(url).toBe(
      'https://app.place.community/auth/callback?next=%2Finvite%2Faccept%2Ftok_abc123',
    )
  })

  it('normaliza nextPath sin slash inicial agregándolo', () => {
    const url = authCallbackUrlForNext('inbox')
    expect(url).toBe('https://app.place.community/auth/callback?next=%2Finbox')
  })

  it('preserva caracteres especiales del path via encodeURIComponent', () => {
    // Caracteres safe en path normal: letters, digits, /, -, _.
    // Pero el path va URL-encoded, así que el / queda como %2F.
    const url = authCallbackUrlForNext('/path/with-dashes_and_underscores/123')
    expect(url).toBe(
      'https://app.place.community/auth/callback?next=%2Fpath%2Fwith-dashes_and_underscores%2F123',
    )
  })

  it('encoding seguro contra injection (query string en el path)', () => {
    // Si alguien llama con un path que ya tiene query (no debería), el encoding
    // del helper neutraliza el riesgo de manipular query string del callback.
    const url = authCallbackUrlForNext('/foo?injected=evil')
    // El `?` y `=` quedan encoded, por lo que el callback recibe un único
    // `next` con el valor literal — no se "splittea" en query params.
    expect(url).toBe('https://app.place.community/auth/callback?next=%2Ffoo%3Finjected%3Devil')
    expect(url).not.toContain('&injected=evil')
  })
})
