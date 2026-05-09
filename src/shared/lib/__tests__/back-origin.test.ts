import { describe, expect, it } from 'vitest'
import {
  ORIGIN_ZONE_HREF,
  ORIGIN_ZONES,
  backQuery,
  originQuery,
  parseBackHref,
  parseOriginZone,
} from '../back-origin'

describe('parseOriginZone', () => {
  it('acepta cada zona válida del enum', () => {
    for (const zone of ORIGIN_ZONES) {
      expect(parseOriginZone(zone)).toBe(zone)
    }
  })

  it('retorna null para input desconocido', () => {
    expect(parseOriginZone('threads')).toBeNull()
    expect(parseOriginZone('home')).toBeNull()
    expect(parseOriginZone('')).toBeNull()
  })

  it('retorna null para undefined / null / no-string', () => {
    expect(parseOriginZone(undefined)).toBeNull()
    expect(parseOriginZone(null)).toBeNull()
  })
})

describe('originQuery', () => {
  it('arma `?from=<zone>` para zonas válidas', () => {
    expect(originQuery('conversations')).toBe('?from=conversations')
    expect(originQuery('events')).toBe('?from=events')
    expect(originQuery('library')).toBe('?from=library')
  })

  it('retorna string vacío si zone es null', () => {
    expect(originQuery(null)).toBe('')
  })
})

describe('ORIGIN_ZONE_HREF', () => {
  it('mapea cada zona a su URL canónica sin placeSlug', () => {
    expect(ORIGIN_ZONE_HREF.conversations).toBe('/conversations')
    expect(ORIGIN_ZONE_HREF.events).toBe('/events')
    expect(ORIGIN_ZONE_HREF.library).toBe('/library')
  })
})

describe('parseBackHref', () => {
  it('acepta URLs relativas same-origin con paths anidados y query', () => {
    expect(parseBackHref('/conversations/abc')).toBe('/conversations/abc')
    expect(parseBackHref('/library/general/intro')).toBe('/library/general/intro')
    expect(parseBackHref('/conversations/abc?foo=bar')).toBe('/conversations/abc?foo=bar')
    expect(parseBackHref('/')).toBe('/')
  })

  it('rechaza protocolos absolutos (open-redirect guard)', () => {
    expect(parseBackHref('http://evil.com/x')).toBeNull()
    expect(parseBackHref('https://evil.com/x')).toBeNull()
    expect(parseBackHref('javascript:alert(1)')).toBeNull()
    expect(parseBackHref('data:text/html,foo')).toBeNull()
  })

  it('rechaza protocol-relative `//host`', () => {
    expect(parseBackHref('//evil.com/x')).toBeNull()
    expect(parseBackHref('//')).toBeNull()
  })

  it('rechaza path traversal con ".."', () => {
    expect(parseBackHref('/conversations/../../../etc/passwd')).toBeNull()
    expect(parseBackHref('/..')).toBeNull()
  })

  it('rechaza control chars (NULL, BEL, etc.)', () => {
    expect(parseBackHref('/conversations\x00/x')).toBeNull()
    expect(parseBackHref('/conversations\nfoo')).toBeNull()
  })

  it('rechaza paths que no empiezan con `/`', () => {
    expect(parseBackHref('conversations/abc')).toBeNull()
    expect(parseBackHref('?back=/x')).toBeNull()
  })

  it('rechaza vacío, undefined, null, no-string', () => {
    expect(parseBackHref('')).toBeNull()
    expect(parseBackHref(undefined)).toBeNull()
    expect(parseBackHref(null)).toBeNull()
  })

  it('rechaza URLs > 500 chars (DoS guard)', () => {
    expect(parseBackHref('/x' + 'a'.repeat(500))).toBeNull()
  })
})

describe('backQuery', () => {
  it('arma `?back=<encoded>` para href válido', () => {
    expect(backQuery('/conversations/abc')).toBe('?back=%2Fconversations%2Fabc')
    expect(backQuery('/library/general/intro')).toBe('?back=%2Flibrary%2Fgeneral%2Fintro')
  })

  it('retorna string vacío si href es null', () => {
    expect(backQuery(null)).toBe('')
  })

  it('escape correcto de query interno (& como %26)', () => {
    expect(backQuery('/x?a=1&b=2')).toBe('?back=%2Fx%3Fa%3D1%26b%3D2')
  })
})
