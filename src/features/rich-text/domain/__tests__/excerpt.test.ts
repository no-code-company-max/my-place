/**
 * Tests del extractor de texto plano para excerpts.
 */

import { describe, expect, it } from 'vitest'
import type { LexicalDocument } from '../types'
import { richTextExcerpt } from '../excerpt'

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

const text = (s: string) => ({
  type: 'text' as const,
  version: 1 as const,
  text: s,
  format: 0,
  detail: 0,
  mode: 'normal' as const,
  style: '',
})

const para = (children: ReadonlyArray<unknown>) => ({
  type: 'paragraph' as const,
  version: 1 as const,
  format: '' as const,
  indent: 0,
  direction: 'ltr' as const,
  textFormat: 0,
  textStyle: '',
  children,
})

describe('richTextExcerpt', () => {
  it('paragraph con texto: devuelve el texto', () => {
    expect(richTextExcerpt(docOf([para([text('hola mundo')])]))).toBe('hola mundo')
  })

  it('heading + paragraph: une con newline', () => {
    const heading = {
      type: 'heading',
      version: 1,
      tag: 'h1',
      format: '',
      indent: 0,
      direction: 'ltr',
      children: [text('título')],
    }
    expect(richTextExcerpt(docOf([heading, para([text('cuerpo')])]))).toBe('título\ncuerpo')
  })

  it('mention: incluye el label', () => {
    const mention = {
      type: 'mention',
      version: 1,
      kind: 'user',
      targetId: 'u1',
      targetSlug: 's',
      label: 'Max',
      placeId: 'p1',
    }
    expect(richTextExcerpt(docOf([para([text('hola '), mention])]))).toBe('hola Max')
  })

  it('embed: ignorado en el excerpt', () => {
    const yt = { type: 'youtube', version: 1, videoId: 'abc' }
    expect(richTextExcerpt(docOf([para([text('mira esto')]), yt]))).toBe('mira esto')
  })

  it('texto largo: trunca con … en el cap', () => {
    const long = 'a'.repeat(500)
    const result = richTextExcerpt(docOf([para([text(long)])]))
    expect(result.endsWith('…')).toBe(true)
    expect(result.length).toBeLessThanOrEqual(281) // 280 + …
  })

  it('texto exacto al cap: no agrega …', () => {
    const exact = 'b'.repeat(280)
    expect(richTextExcerpt(docOf([para([text(exact)])]))).toBe(exact)
  })

  it('cap configurable via 2do argumento', () => {
    const result = richTextExcerpt(docOf([para([text('hola mundo querido')])]), 5)
    expect(result.endsWith('…')).toBe(true)
    expect(result.length).toBeLessThanOrEqual(6)
  })

  it('lista bullet: aplana cada item como párrafo', () => {
    const list = {
      type: 'list',
      version: 1,
      listType: 'bullet',
      start: 1,
      tag: 'ul',
      format: '',
      indent: 0,
      direction: 'ltr',
      children: [
        {
          type: 'listitem',
          version: 1,
          value: 1,
          format: '',
          indent: 0,
          direction: 'ltr',
          children: [text('uno')],
        },
        {
          type: 'listitem',
          version: 1,
          value: 2,
          format: '',
          indent: 0,
          direction: 'ltr',
          children: [text('dos')],
        },
      ],
    }
    expect(richTextExcerpt(docOf([list]))).toBe('uno\ndos')
  })
})
