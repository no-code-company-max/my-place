import { describe, it, expect } from 'vitest'
import { htmlRedirect } from '../auth-redirect-html'

describe('htmlRedirect', () => {
  it('retorna 200 OK con content-type html', () => {
    const res = htmlRedirect(new URL('https://www.place.community/inbox'))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/html')
  })

  it('emite cache-control no-store (no cachear el redirect)', () => {
    const res = htmlRedirect(new URL('https://www.place.community/inbox'))
    expect(res.headers.get('cache-control')).toContain('no-store')
  })

  it('body contiene meta refresh + script con la URL destino', async () => {
    const res = htmlRedirect(new URL('https://www.place.community/inbox'))
    const body = await res.text()
    expect(body).toContain('<meta http-equiv="refresh"')
    expect(body).toContain('https://www.place.community/inbox')
    expect(body).toContain('window.location.replace')
  })

  it('escape HTML en attributes (defense in depth contra URL maliciosa)', async () => {
    // Aunque URL nunca debería tener `<` o `>` literales, defendemos contra
    // bug futuro que pase un target sin sanitizar.
    const url = new URL('https://www.place.community/path')
    // Mutamos el toString del URL artificialmente (no posible en práctica
    // con un URL real) — solo verificamos que el escapeHtmlAttr funciona si
    // alguien pasa caracteres "<>&\"" en la URL.
    const dangerous = `https://www.place.community/?evil="><script>alert(1)</script>`
    const dangerousUrl = Object.create(url) as URL
    Object.defineProperty(dangerousUrl, 'toString', { value: () => dangerous })
    const res = htmlRedirect(dangerousUrl)
    const body = await res.text()
    expect(body).not.toContain('"><script>alert')
    expect(body).toContain('&quot;&gt;&lt;script&gt;')
  })

  it('noscript fallback con anchor para users sin JS', async () => {
    const res = htmlRedirect(new URL('https://www.place.community/inbox'))
    const body = await res.text()
    expect(body).toContain('<noscript>')
    expect(body).toContain('href="https://www.place.community/inbox"')
  })
})
