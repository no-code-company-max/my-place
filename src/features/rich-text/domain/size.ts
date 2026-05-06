/**
 * Caps de tamaño + profundidad del rich-text AST.
 *
 * `assertRichTextSize` se invoca desde server actions de los slices
 * consumidores (discussions, library, events) antes de persistir el body.
 *
 * Los caps se mantuvieron iguales a los del editor TipTap pre-migración:
 * 20 KB de body serializado + 5 niveles de lista anidada. Justificación
 * en `docs/decisions/2026-04-20-discussions-size-exception.md`.
 */

import type { LexicalDocument, ListItemNode, ListNode } from './types'
import { RichTextTooDeepError, RichTextTooLargeError } from './errors'

/** 20 KB en bytes UTF-8 del AST serializado. */
export const RICH_TEXT_MAX_BYTES = 20 * 1024

/** Profundidad máxima de listas anidadas. */
export const RICH_TEXT_MAX_LIST_DEPTH = 5

export function richTextByteSize(doc: LexicalDocument): number {
  return new TextEncoder().encode(JSON.stringify(doc)).byteLength
}

/**
 * Profundidad efectiva del nido de listas. Cada `ListNode` descendido suma 1.
 * `ListItemNode` es transparente — el contador sólo avanza al volver a entrar
 * en otro `list`.
 */
export function richTextMaxListDepth(doc: LexicalDocument): number {
  let max = 0
  for (const block of doc.root.children) {
    if (block.type === 'list') {
      const inner = walkListDepth(block, 1)
      if (inner > max) max = inner
    }
  }
  return max
}

function walkListDepth(list: ListNode, currentDepth: number): number {
  let max = currentDepth
  for (const item of list.children) {
    const inner = walkListItem(item, currentDepth)
    if (inner > max) max = inner
  }
  return max
}

function walkListItem(item: ListItemNode, currentDepth: number): number {
  let max = currentDepth
  for (const child of item.children) {
    if (child.type === 'list') {
      const inner = walkListDepth(child, currentDepth + 1)
      if (inner > max) max = inner
    }
  }
  return max
}

export type AssertRichTextSizeOpts = {
  maxBytes?: number
  maxListDepth?: number
}

export function assertRichTextSize(doc: LexicalDocument, opts: AssertRichTextSizeOpts = {}): void {
  const maxBytes = opts.maxBytes ?? RICH_TEXT_MAX_BYTES
  const bytes = richTextByteSize(doc)
  if (bytes > maxBytes) {
    throw new RichTextTooLargeError(bytes, maxBytes)
  }

  const maxDepth = opts.maxListDepth ?? RICH_TEXT_MAX_LIST_DEPTH
  const depth = richTextMaxListDepth(doc)
  if (depth > maxDepth) {
    throw new RichTextTooDeepError(depth, maxDepth)
  }
}
