/**
 * Tests del builder de QuoteSnapshot.
 */

import { describe, expect, it } from 'vitest'
import type { LexicalDocument } from '../types'
import { buildQuoteSnapshot } from '../snapshot'

const docOf = (children: ReadonlyArray<unknown>): LexicalDocument => ({
  root: {
    type: 'root',
    version: 1,
    format: '',
    indent: 0,
    direction: null,
    children: children as never,
  },
})

const para = (s: string) => ({
  type: 'paragraph' as const,
  version: 1 as const,
  format: '' as const,
  indent: 0,
  direction: 'ltr' as const,
  textFormat: 0,
  textStyle: '',
  children: [
    {
      type: 'text' as const,
      version: 1 as const,
      text: s,
      format: 0,
      detail: 0,
      mode: 'normal' as const,
      style: '',
    },
  ],
})

describe('buildQuoteSnapshot', () => {
  it('copia author + source labels al output', () => {
    const body = docOf([para('hola')])
    const snap = buildQuoteSnapshot({
      comment: { body, authorLabel: 'Max' },
      sourceLabel: 'Pan de campo',
    })
    expect(snap.authorLabel).toBe('Max')
    expect(snap.sourceLabel).toBe('Pan de campo')
  })

  it('excerpt es truncado a 280 chars con …', () => {
    const big = 'a'.repeat(500)
    const snap = buildQuoteSnapshot({
      comment: { body: docOf([para(big)]), authorLabel: 'Max' },
      sourceLabel: 'Tema X',
    })
    expect(snap.excerpt.endsWith('…')).toBe(true)
    expect(snap.excerpt.length).toBeLessThanOrEqual(281)
  })

  it('body se preserva por referencia (snapshot congelado del JSON)', () => {
    const body = docOf([para('hola')])
    const snap = buildQuoteSnapshot({
      comment: { body, authorLabel: 'Max' },
      sourceLabel: 'X',
    })
    expect(snap.body).toBe(body)
  })

  it('texto vacío produce excerpt vacío', () => {
    const snap = buildQuoteSnapshot({
      comment: { body: docOf([para('')]), authorLabel: 'Max' },
      sourceLabel: 'X',
    })
    expect(snap.excerpt).toBe('')
  })
})
