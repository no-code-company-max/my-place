import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/shared/config/env', () => ({
  clientEnv: { NEXT_PUBLIC_APP_DOMAIN: 'place.community' },
}))

import { cleanupLegacyCookies } from '../cookie-cleanup'

type CookieRecord = { name: string; value: string }
type SetCall = {
  name: string
  value: string
  options: { domain?: string; maxAge?: number; path?: string }
}

function fakeReq(cookies: CookieRecord[]): Parameters<typeof cleanupLegacyCookies>[0] {
  return {
    cookies: {
      getAll: () => cookies,
    },
  } as Parameters<typeof cleanupLegacyCookies>[0]
}

function fakeResponse() {
  const calls: SetCall[] = []
  const response = {
    cookies: {
      set: (name: string, value: string, options: SetCall['options']) => {
        calls.push({ name, value, options })
      },
    },
  } as unknown as Parameters<typeof cleanupLegacyCookies>[1]
  return { response, calls }
}

describe('cleanupLegacyCookies', () => {
  let calls: SetCall[]
  let response: Parameters<typeof cleanupLegacyCookies>[1]

  beforeEach(() => {
    const fr = fakeResponse()
    response = fr.response
    calls = fr.calls
  })

  it('sin cookies sb-* en el request → no emite Set-Cookie', () => {
    cleanupLegacyCookies(fakeReq([{ name: 'other', value: 'foo' }]), response)
    expect(calls).toHaveLength(0)
  })

  it('cookie sb-tkidot-auth-token presente → emite cleanup en domains alternativos', () => {
    cleanupLegacyCookies(fakeReq([{ name: 'sb-tkidot-auth-token', value: 'whatever' }]), response)

    // Esperamos cleanup en:
    // - Domain=app.<apex> (subdomain potencialmente legacy)
    // - host-only (sin Domain) — cookies que pueden quedar pegadas en el subdomain
    expect(calls).toHaveLength(2)

    const subdomainCleanup = calls.find((c) => c.options.domain === 'app.place.community')
    expect(subdomainCleanup).toBeDefined()
    expect(subdomainCleanup?.name).toBe('sb-tkidot-auth-token')
    expect(subdomainCleanup?.value).toBe('')
    expect(subdomainCleanup?.options.maxAge).toBe(0)
    expect(subdomainCleanup?.options.path).toBe('/')

    const hostOnly = calls.find((c) => c.options.domain === undefined)
    expect(hostOnly).toBeDefined()
    expect(hostOnly?.name).toBe('sb-tkidot-auth-token')
    expect(hostOnly?.options.maxAge).toBe(0)
  })

  it('chunked cookies (sb-tkidot-auth-token.0, .1) → cubre todas', () => {
    cleanupLegacyCookies(
      fakeReq([
        { name: 'sb-tkidot-auth-token.0', value: 'chunk-a' },
        { name: 'sb-tkidot-auth-token.1', value: 'chunk-b' },
      ]),
      response,
    )

    // 2 cookies × 2 domains alternativos = 4 cleanups.
    expect(calls).toHaveLength(4)

    const cleanedNames = new Set(calls.map((c) => c.name))
    expect(cleanedNames).toEqual(new Set(['sb-tkidot-auth-token.0', 'sb-tkidot-auth-token.1']))
  })

  it('multiples auth tokens (refresh + access) → cleanup independiente', () => {
    cleanupLegacyCookies(
      fakeReq([
        { name: 'sb-tkidot-auth-token', value: 'access' },
        { name: 'sb-otherproj-auth-token', value: 'access2' },
      ]),
      response,
    )

    expect(calls).toHaveLength(4) // 2 cookies × 2 domains
    const tokenNames = new Set(calls.map((c) => c.name))
    expect(tokenNames).toEqual(new Set(['sb-tkidot-auth-token', 'sb-otherproj-auth-token']))
  })

  it('ignora cookies que no matchean pattern sb-*-auth-token', () => {
    cleanupLegacyCookies(
      fakeReq([
        { name: 'sb-tkidot-auth-token', value: 'real' },
        { name: 'sb-something-else', value: 'unrelated' },
        { name: 'sb-no-suffix', value: 'unrelated' },
        { name: 'random', value: 'r' },
      ]),
      response,
    )

    // Solo sb-tkidot-auth-token cuenta → 2 cleanups.
    expect(calls).toHaveLength(2)
    expect(calls.every((c) => c.name === 'sb-tkidot-auth-token')).toBe(true)
  })

  it('idempotente: invocar dos veces sobre el mismo response duplica calls (no se filtra) — el handler solo lo invoca una vez', () => {
    // Esta semántica es intencional: la función no trackea estado. El caller
    // debe invocarla una sola vez por request. Test documenta el contrato.
    const req = fakeReq([{ name: 'sb-tkidot-auth-token', value: 'x' }])
    cleanupLegacyCookies(req, response)
    cleanupLegacyCookies(req, response)
    expect(calls).toHaveLength(4)
  })
})
