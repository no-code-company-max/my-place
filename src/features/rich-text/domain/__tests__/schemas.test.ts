/**
 * Tests del schema Zod del Lexical AST + subsets por surface.
 *
 * Cubre 15+ casos: válidos básicos, refines de URL, kind discriminado,
 * heading levels, embeds, listas anidadas, root malformado.
 */

import { describe, expect, it } from 'vitest'
import {
  commentDocumentSchema,
  eventDocumentSchema,
  libraryItemDocumentSchema,
  postDocumentSchema,
  richTextDocumentSchema,
} from '../schemas'

const emptyRoot = {
  type: 'root',
  version: 1,
  format: '',
  indent: 0,
  direction: null,
  children: [],
}

const text = (s: string, format = 0) => ({
  type: 'text',
  version: 1,
  text: s,
  format,
  detail: 0,
  mode: 'normal',
  style: '',
})

const para = (children: ReadonlyArray<unknown>) => ({
  type: 'paragraph',
  version: 1,
  format: '',
  indent: 0,
  direction: 'ltr',
  textFormat: 0,
  textStyle: '',
  children,
})

const heading = (tag: string, children: ReadonlyArray<unknown>) => ({
  type: 'heading',
  version: 1,
  tag,
  format: '',
  indent: 0,
  direction: 'ltr',
  children,
})

const docOf = (children: ReadonlyArray<unknown>) => ({
  root: { ...emptyRoot, children },
})

describe('richTextDocumentSchema', () => {
  it('acepta documento canónico vacío', () => {
    expect(richTextDocumentSchema.safeParse({ root: emptyRoot }).success).toBe(true)
  })

  it('acepta paragraph con texto', () => {
    expect(richTextDocumentSchema.safeParse(docOf([para([text('hola')])])).success).toBe(true)
  })

  it('acepta texto con bold (format=1)', () => {
    expect(richTextDocumentSchema.safeParse(docOf([para([text('bold', 1)])])).success).toBe(true)
  })

  it('acepta link con URL https', () => {
    const link = {
      type: 'link',
      version: 1,
      url: 'https://example.com/a',
      rel: null,
      target: null,
      title: null,
      format: '',
      indent: 0,
      direction: null,
      children: [text('click')],
    }
    expect(richTextDocumentSchema.safeParse(docOf([para([link])])).success).toBe(true)
  })

  it('rechaza link con URL inválida', () => {
    const link = {
      type: 'link',
      version: 1,
      url: 'not-a-url',
      rel: null,
      target: null,
      title: null,
      format: '',
      indent: 0,
      direction: null,
      children: [text('click')],
    }
    expect(richTextDocumentSchema.safeParse(docOf([para([link])])).success).toBe(false)
  })

  it('acepta mention kind=user', () => {
    const mention = {
      type: 'mention',
      version: 1,
      kind: 'user',
      targetId: 'usr_1',
      targetSlug: 'max',
      label: 'Max',
      placeId: 'place_1',
    }
    expect(richTextDocumentSchema.safeParse(docOf([para([mention])])).success).toBe(true)
  })

  it('rechaza mention kind=other', () => {
    const mention = {
      type: 'mention',
      version: 1,
      kind: 'other',
      targetId: 'x',
      targetSlug: 'x',
      label: 'X',
      placeId: 'place_1',
    }
    expect(richTextDocumentSchema.safeParse(docOf([para([mention])])).success).toBe(false)
  })

  it('acepta heading h1', () => {
    expect(richTextDocumentSchema.safeParse(docOf([heading('h1', [text('título')])])).success).toBe(
      true,
    )
  })

  it('rechaza heading h4 (fuera del subset)', () => {
    expect(richTextDocumentSchema.safeParse(docOf([heading('h4', [text('x')])])).success).toBe(
      false,
    )
  })

  it('acepta lista no ordenada con item', () => {
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
      ],
    }
    expect(richTextDocumentSchema.safeParse(docOf([list])).success).toBe(true)
  })

  it('acepta youtube embed', () => {
    const yt = { type: 'youtube', version: 1, videoId: 'abc123' }
    expect(richTextDocumentSchema.safeParse(docOf([yt])).success).toBe(true)
  })

  it('rechaza embed con tipo no listado', () => {
    const bad = { type: 'vimeo', version: 1, videoId: 'x' }
    expect(richTextDocumentSchema.safeParse(docOf([bad])).success).toBe(false)
  })

  it('rechaza root.type ≠ root', () => {
    expect(richTextDocumentSchema.safeParse({ root: { ...emptyRoot, type: 'doc' } }).success).toBe(
      false,
    )
  })

  it('rechaza children que no es array', () => {
    expect(
      richTextDocumentSchema.safeParse({ root: { ...emptyRoot, children: 'invalid' } }).success,
    ).toBe(false)
  })
})

describe('subsets por surface', () => {
  it('comment subset acepta paragraph + text + link + mention', () => {
    const link = {
      type: 'link',
      version: 1,
      url: 'https://example.com',
      rel: null,
      target: null,
      title: null,
      format: '',
      indent: 0,
      direction: null,
      children: [text('a')],
    }
    const mention = {
      type: 'mention',
      version: 1,
      kind: 'user' as const,
      targetId: 'u1',
      targetSlug: 's',
      label: 'L',
      placeId: 'p1',
    }
    expect(
      commentDocumentSchema.safeParse(docOf([para([text('hola'), link, mention])])).success,
    ).toBe(true)
  })

  it('comment subset rechaza heading', () => {
    expect(commentDocumentSchema.safeParse(docOf([heading('h1', [text('x')])])).success).toBe(false)
  })

  it('comment subset rechaza embed youtube', () => {
    const yt = { type: 'youtube', version: 1, videoId: 'abc' }
    expect(commentDocumentSchema.safeParse(docOf([yt])).success).toBe(false)
  })

  it('comment subset rechaza listas', () => {
    const list = {
      type: 'list',
      version: 1,
      listType: 'bullet',
      start: 1,
      tag: 'ul',
      format: '',
      indent: 0,
      direction: 'ltr',
      children: [],
    }
    expect(commentDocumentSchema.safeParse(docOf([list])).success).toBe(false)
  })

  it('post subset acepta heading + lista + embed', () => {
    const list = {
      type: 'list',
      version: 1,
      listType: 'number',
      start: 1,
      tag: 'ol',
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
      ],
    }
    const yt = { type: 'youtube', version: 1, videoId: 'abc' }
    expect(
      postDocumentSchema.safeParse(docOf([heading('h2', [text('x')]), list, yt])).success,
    ).toBe(true)
  })

  it('event subset rechaza heading (mismo perfil que comment)', () => {
    expect(eventDocumentSchema.safeParse(docOf([heading('h1', [text('x')])])).success).toBe(false)
  })

  it('library item subset acepta embed spotify', () => {
    const sp = {
      type: 'spotify',
      version: 1,
      kind: 'track',
      externalId: 'abc',
    }
    expect(libraryItemDocumentSchema.safeParse(docOf([sp])).success).toBe(true)
  })
})
