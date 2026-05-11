import { describe, it, expect } from 'vitest'
import { htmlRedirect } from '../auth-redirect-html'

describe('htmlRedirect — comportamiento base', () => {
  it('retorna 200 OK con content-type html', () => {
    const res = htmlRedirect(new URL('https://www.place.community/inbox'))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/html')
  })

  it('emite cache-control no-store (no cachear el redirect)', () => {
    const res = htmlRedirect(new URL('https://www.place.community/inbox'))
    expect(res.headers.get('cache-control')).toContain('no-store')
  })

  it('body contiene anchor button con la URL destino (user interaction requerida)', async () => {
    const res = htmlRedirect(new URL('https://www.place.community/inbox'))
    const body = await res.text()
    expect(body).toContain('href="https://www.place.community/inbox"')
  })

  it('NO usa auto-redirect (Safari iOS ITP rechaza Set-Cookie sin user click)', async () => {
    const res = htmlRedirect(new URL('https://www.place.community/inbox'))
    const body = await res.text()
    expect(body).not.toContain('window.location.replace')
    expect(body).not.toContain('http-equiv="refresh"')
  })

  it('escape HTML en attributes (defense in depth contra URL maliciosa)', async () => {
    const url = new URL('https://www.place.community/path')
    const dangerous = `https://www.place.community/?evil="><script>alert(1)</script>`
    const dangerousUrl = Object.create(url) as URL
    Object.defineProperty(dangerousUrl, 'toString', { value: () => dangerous })
    const res = htmlRedirect(dangerousUrl)
    const body = await res.text()
    expect(body).not.toContain('"><script>alert')
    expect(body).toContain('&quot;&gt;&lt;script&gt;')
  })

  it('incluye <meta name="viewport"> (mobile rendering)', async () => {
    const res = htmlRedirect(new URL('https://www.place.community/inbox'))
    const body = await res.text()
    expect(body).toContain('width=device-width')
  })

  it('incluye noindex (no queremos indexar páginas intermedias)', async () => {
    const res = htmlRedirect(new URL('https://www.place.community/inbox'))
    const body = await res.text()
    expect(body).toContain('name="robots" content="noindex"')
  })

  it('renderiza el wordmark "Place" como brand mínimo', async () => {
    const res = htmlRedirect(new URL('https://www.place.community/inbox'))
    const body = await res.text()
    expect(body).toContain('class="brand">Place')
  })
})

describe('htmlRedirect — copy según kind', () => {
  describe('kind: "login" (default)', () => {
    it('default sin options usa copy de login', async () => {
      const res = htmlRedirect(new URL('https://app.place.community/'))
      const body = await res.text()
      expect(body).toContain('Bienvenido')
      expect(body).toContain('Entrar a Place')
    })

    it('explícito kind: "login" tiene mismo copy que default', async () => {
      const res = htmlRedirect(new URL('https://app.place.community/'), { kind: 'login' })
      const body = await res.text()
      expect(body).toContain('Bienvenido')
      expect(body).toContain('Entrar a Place')
    })

    it('NO menciona "invitación" en copy de login', async () => {
      const res = htmlRedirect(new URL('https://app.place.community/'), { kind: 'login' })
      const body = await res.text()
      expect(body).not.toContain('invitación')
      expect(body).not.toContain('Aceptar')
    })

    it('título de página coherente con flow', async () => {
      const res = htmlRedirect(new URL('https://app.place.community/'), { kind: 'login' })
      const body = await res.text()
      expect(body).toContain('<title>Entrar a Place</title>')
    })
  })

  describe('kind: "invite"', () => {
    it('copy de invite sin placeName muestra botón genérico', async () => {
      const res = htmlRedirect(new URL('https://the-company.place.community/'), { kind: 'invite' })
      const body = await res.text()
      expect(body).toContain('Estamos por sumarte')
      expect(body).toContain('Aceptar invitación →')
      expect(body).not.toContain('Entrar a Place')
    })

    it('copy de invite CON placeName personaliza el botón', async () => {
      const res = htmlRedirect(new URL('https://the-company.place.community/'), {
        kind: 'invite',
        placeName: 'The Company',
      })
      const body = await res.text()
      expect(body).toContain('Aceptar invitación a The Company →')
    })

    it('título de página coherente con flow invite', async () => {
      const res = htmlRedirect(new URL('https://the-company.place.community/'), { kind: 'invite' })
      const body = await res.text()
      expect(body).toContain('<title>Aceptar invitación · Place</title>')
    })

    it('escape HTML del placeName (defensa contra inyección desde DB)', async () => {
      const res = htmlRedirect(new URL('https://x.place.community/'), {
        kind: 'invite',
        placeName: '<script>alert("xss")</script>',
      })
      const body = await res.text()
      expect(body).not.toContain('<script>alert')
      expect(body).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;')
    })
  })

  describe('copy compartido', () => {
    it('explica el motivo del extra click (anti-spam reassurance)', async () => {
      const res = htmlRedirect(new URL('https://app.place.community/'))
      const body = await res.text()
      expect(body).toContain('clientes de email')
      expect(body).toContain('asegurarnos que sos vos')
    })
  })
})
