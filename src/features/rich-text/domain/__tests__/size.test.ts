/**
 * Tests del cap de tamaño + profundidad de listas.
 */

import { describe, expect, it } from 'vitest'
import type { LexicalDocument, ListNode } from '../types'
import { RichTextTooDeepError, RichTextTooLargeError } from '../errors'
import {
  RICH_TEXT_MAX_BYTES,
  RICH_TEXT_MAX_LIST_DEPTH,
  assertRichTextSize,
  richTextByteSize,
  richTextMaxListDepth,
} from '../size'

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

const para = (text: string) => ({
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
      text,
      format: 0,
      detail: 0,
      mode: 'normal' as const,
      style: '',
    },
  ],
})

function nestedList(depth: number): ListNode {
  // listitem.children = [ListNode] → cada nivel suma 1.
  let inner: ListNode = {
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
        children: [],
      },
    ],
  }
  for (let i = 1; i < depth; i++) {
    inner = {
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
          children: [inner],
        },
      ],
    }
  }
  return inner
}

describe('richTextByteSize', () => {
  it('mide bytes UTF-8 del documento serializado', () => {
    const doc = docOf([para('hola')])
    expect(richTextByteSize(doc)).toBe(new TextEncoder().encode(JSON.stringify(doc)).byteLength)
  })
})

describe('richTextMaxListDepth', () => {
  it('retorna 0 para documento sin listas', () => {
    expect(richTextMaxListDepth(docOf([para('hola')]))).toBe(0)
  })

  it('retorna 3 para listas anidadas 3 niveles', () => {
    expect(richTextMaxListDepth(docOf([nestedList(3)]))).toBe(3)
  })
})

describe('assertRichTextSize', () => {
  it('no throws para doc dentro del cap', () => {
    expect(() => assertRichTextSize(docOf([para('hola')]))).not.toThrow()
  })

  it('throws RichTextTooLargeError si excede 20 KB', () => {
    // Genera un texto que supere 20 KB encodeado.
    const big = 'a'.repeat(RICH_TEXT_MAX_BYTES + 100)
    expect(() => assertRichTextSize(docOf([para(big)]))).toThrow(RichTextTooLargeError)
  })

  it('respeta el override de maxBytes en opts', () => {
    const doc = docOf([para('hola mundo')])
    expect(() => assertRichTextSize(doc, { maxBytes: 1 })).toThrow(RichTextTooLargeError)
  })

  it('no throws para listas dentro del depth cap', () => {
    expect(() => assertRichTextSize(docOf([nestedList(RICH_TEXT_MAX_LIST_DEPTH)]))).not.toThrow()
  })

  it('throws RichTextTooDeepError si listas exceden 5 niveles', () => {
    expect(() => assertRichTextSize(docOf([nestedList(RICH_TEXT_MAX_LIST_DEPTH + 1)]))).toThrow(
      RichTextTooDeepError,
    )
  })

  it('respeta el override de maxListDepth en opts', () => {
    expect(() => assertRichTextSize(docOf([nestedList(2)]), { maxListDepth: 1 })).toThrow(
      RichTextTooDeepError,
    )
  })
})
