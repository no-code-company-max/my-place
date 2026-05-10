import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * Tests del cleanup proactivo (Sesión 3 del plan de hardening).
 *
 * Cubre:
 *  - findDuplicatedAuthTokenCookies parser (unit)
 *  - buildProactiveResidualCleanupResponse (integration)
 */

const PROJECT_REF = 'tkidotchffveygzisxbn'
const APEX = 'place.community'
const SUBDOMAIN_HOST = `the-company.${APEX}`

const loggerWarnMock = vi.fn()

vi.mock('@/shared/config/env', () => ({
  clientEnv: {
    NEXT_PUBLIC_APP_URL: 'https://place.community',
    NEXT_PUBLIC_APP_DOMAIN: 'place.community',
    NEXT_PUBLIC_SUPABASE_URL: 'https://tkidotchffveygzisxbn.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
  },
}))

vi.mock('@/shared/lib/logger', () => ({
  logger: {
    warn: (...a: unknown[]) => loggerWarnMock(...a),
    info: vi.fn(),
    error: vi.fn(),
    child: () => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn() }),
  },
}))

import {
  buildProactiveResidualCleanupResponse,
  findDuplicatedAuthTokenCookies,
} from '../proactive-residual-cleanup'

beforeEach(() => {
  loggerWarnMock.mockReset()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('findDuplicatedAuthTokenCookies (parser)', () => {
  it('header vacío → []', () => {
    expect(findDuplicatedAuthTokenCookies('', PROJECT_REF)).toEqual([])
  })

  it('cookie única (name no duplicado) → []', () => {
    const header = `sb-${PROJECT_REF}-auth-token=value1`
    expect(findDuplicatedAuthTokenCookies(header, PROJECT_REF)).toEqual([])
  })

  it('cookie duplicada misma name → [name]', () => {
    const header = `sb-${PROJECT_REF}-auth-token=apexValue; sb-${PROJECT_REF}-auth-token=hostOnlyValue`
    expect(findDuplicatedAuthTokenCookies(header, PROJECT_REF)).toEqual([
      `sb-${PROJECT_REF}-auth-token`,
    ])
  })

  it('chunks duplicados (`.0`, `.1`) detectados independientemente', () => {
    const header =
      `sb-${PROJECT_REF}-auth-token.0=apex0; sb-${PROJECT_REF}-auth-token.0=hostOnly0; ` +
      `sb-${PROJECT_REF}-auth-token.1=apex1; sb-${PROJECT_REF}-auth-token.1=hostOnly1`
    const dups = findDuplicatedAuthTokenCookies(header, PROJECT_REF)
    expect(dups).toContain(`sb-${PROJECT_REF}-auth-token.0`)
    expect(dups).toContain(`sb-${PROJECT_REF}-auth-token.1`)
    expect(dups).toHaveLength(2)
  })

  it('cookies de OTROS project refs duplicadas NO se reportan (filtro por currentRef)', () => {
    const otherRef = 'pdifweaajellxzdpbaht'
    const header = `sb-${otherRef}-auth-token=v1; sb-${otherRef}-auth-token=v2`
    expect(findDuplicatedAuthTokenCookies(header, PROJECT_REF)).toEqual([])
  })

  it('cookies no-supabase duplicadas NO se reportan', () => {
    const header = `session=a; session=b; _ga=x; _ga=y`
    expect(findDuplicatedAuthTokenCookies(header, PROJECT_REF)).toEqual([])
  })

  it('whitespace tolerante (RFC 6265 permite espacios alrededor de `;`)', () => {
    const header = `sb-${PROJECT_REF}-auth-token=v1  ;   sb-${PROJECT_REF}-auth-token=v2`
    expect(findDuplicatedAuthTokenCookies(header, PROJECT_REF)).toEqual([
      `sb-${PROJECT_REF}-auth-token`,
    ])
  })

  it('value con `=` interno (base64 padding) no rompe parsing del name', () => {
    const header =
      `sb-${PROJECT_REF}-auth-token=base64-eyJ0ZXN0Ijp0cnVlfQ==; ` +
      `sb-${PROJECT_REF}-auth-token=base64-eyJvdGhlciI6dHJ1ZX0=`
    expect(findDuplicatedAuthTokenCookies(header, PROJECT_REF)).toEqual([
      `sb-${PROJECT_REF}-auth-token`,
    ])
  })

  it('mix: 1 cookie target duplicada + 1 cookie unique + 1 cookie ajena → solo target en result', () => {
    const otherRef = 'pdifweaajellxzdpbaht'
    const header =
      `sb-${PROJECT_REF}-auth-token=v1; sb-${PROJECT_REF}-auth-token=v2; ` +
      `sb-${PROJECT_REF}-auth-token-code-verifier=verifier; ` +
      `sb-${otherRef}-auth-token=other`
    expect(findDuplicatedAuthTokenCookies(header, PROJECT_REF)).toEqual([
      `sb-${PROJECT_REF}-auth-token`,
    ])
  })
})

function mkReq(cookieHeader: string): NextRequest {
  return new NextRequest(`https://${SUBDOMAIN_HOST}/`, {
    headers: cookieHeader
      ? { cookie: cookieHeader, host: SUBDOMAIN_HOST }
      : { host: SUBDOMAIN_HOST },
  })
}

describe('buildProactiveResidualCleanupResponse', () => {
  it('sin header cookie → null (no cleanup needed)', () => {
    const req = mkReq('')
    expect(buildProactiveResidualCleanupResponse(req)).toBeNull()
  })

  it('cookie única → null', () => {
    const req = mkReq(`sb-${PROJECT_REF}-auth-token=value1`)
    expect(buildProactiveResidualCleanupResponse(req)).toBeNull()
  })

  it('cookies duplicadas → NextResponse 307 redirect al mismo URL', () => {
    const req = mkReq(`sb-${PROJECT_REF}-auth-token=v1; sb-${PROJECT_REF}-auth-token=v2`)
    const res = buildProactiveResidualCleanupResponse(req)
    expect(res).not.toBeNull()
    expect(res?.status).toBe(307)
    expect(res?.headers.get('location')).toBe(`https://${SUBDOMAIN_HOST}/`)
  })

  it('cookies duplicadas → response trae Set-Cookie maxAge=0 host-only para cada name', () => {
    const req = mkReq(
      `sb-${PROJECT_REF}-auth-token=v1; sb-${PROJECT_REF}-auth-token=v2; ` +
        `sb-${PROJECT_REF}-auth-token.0=c0a; sb-${PROJECT_REF}-auth-token.0=c0b`,
    )
    const res = buildProactiveResidualCleanupResponse(req)
    const setCookies = res?.headers.getSetCookie?.() ?? []
    const cleanups = setCookies.filter((h) => /Max-Age=0/.test(h))
    expect(cleanups).toHaveLength(2)
    expect(cleanups.some((h) => h.startsWith(`sb-${PROJECT_REF}-auth-token=`))).toBe(true)
    expect(cleanups.some((h) => h.startsWith(`sb-${PROJECT_REF}-auth-token.0=`))).toBe(true)
    // Cleanup HOST-ONLY: no Domain, sí Path/Max-Age/Secure/SameSite
    for (const h of cleanups) {
      expect(h).toMatch(/Path=\//)
      expect(h).toMatch(/Max-Age=0/)
      expect(h).toMatch(/Secure/)
      expect(h).toMatch(/SameSite=Lax/)
      expect(h).not.toMatch(/Domain=/)
    }
  })

  it('cookies de OTROS project refs duplicadas → null (no cleanup, no es nuestro problema)', () => {
    const otherRef = 'pdifweaajellxzdpbaht'
    const req = mkReq(`sb-${otherRef}-auth-token=v1; sb-${otherRef}-auth-token=v2`)
    expect(buildProactiveResidualCleanupResponse(req)).toBeNull()
  })

  it('loggea MW_proactive_cleanup con shape esperado cuando detecta duplicados', () => {
    const req = mkReq(`sb-${PROJECT_REF}-auth-token=v1; sb-${PROJECT_REF}-auth-token=v2`)
    buildProactiveResidualCleanupResponse(req)
    const log = loggerWarnMock.mock.calls.find(
      (c) => (c[0] as { debug?: string })?.debug === 'MW_proactive_cleanup',
    )
    expect(log).toBeDefined()
    const meta = log?.[0] as {
      host?: string
      path?: string
      currentRef?: string
      duplicatedCount?: number
      duplicatedNames?: string[]
    }
    expect(meta.host).toBe(SUBDOMAIN_HOST)
    expect(meta.path).toBe('/')
    expect(meta.currentRef).toBe(PROJECT_REF)
    expect(meta.duplicatedCount).toBe(1)
    expect(meta.duplicatedNames).toEqual([`sb-${PROJECT_REF}-auth-token`])
  })

  it('preserva path + query del request original en el redirect', () => {
    const req = new NextRequest(`https://${SUBDOMAIN_HOST}/conversations?foo=bar`, {
      headers: {
        cookie: `sb-${PROJECT_REF}-auth-token=v1; sb-${PROJECT_REF}-auth-token=v2`,
        host: SUBDOMAIN_HOST,
      },
    })
    const res = buildProactiveResidualCleanupResponse(req)
    expect(res?.headers.get('location')).toBe(`https://${SUBDOMAIN_HOST}/conversations?foo=bar`)
  })
})
