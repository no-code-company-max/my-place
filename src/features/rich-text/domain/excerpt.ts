/**
 * Extractor de texto plano del Lexical AST para excerpts.
 *
 * Usado por:
 *  - el slice `discussions` para construir `Comment.quotedSnapshot.bodyExcerpt`
 *    (texto plano de la cita).
 *  - la lista de threads (`PostListView.snippet`) para preview en feeds.
 *  - el render de mention/quote tooltips.
 *
 * Reglas:
 *  - Bloques (paragraph, heading, listitem) se separan por `\n`.
 *  - Listas: cada item es un bloque.
 *  - Mention: aporta su `label`.
 *  - Embed: ignorado (no aporta texto).
 *  - Trunca al `maxChars`-ésimo char con "…" si excede.
 */

import type {
  BlockNode,
  HeadingNode,
  InlineNode,
  LexicalDocument,
  ListItemNode,
  ListNode,
  ParagraphNode,
} from './types'

const DEFAULT_MAX_CHARS = 280

export function richTextExcerpt(doc: LexicalDocument, maxChars = DEFAULT_MAX_CHARS): string {
  const blocks: string[] = []
  for (const block of doc.root.children) {
    visitBlock(block, blocks)
  }
  const joined = blocks.filter((b) => b.length > 0).join('\n')
  if (joined.length <= maxChars) return joined
  return `${joined.slice(0, maxChars)}…`
}

function visitBlock(block: BlockNode, out: string[]): void {
  switch (block.type) {
    case 'paragraph':
    case 'heading':
      out.push(visitInlineContainer(block))
      break
    case 'list':
      visitList(block, out)
      break
    default:
      // embeds (youtube, spotify, apple-podcast, ivoox): no aportan texto.
      break
  }
}

function visitInlineContainer(node: ParagraphNode | HeadingNode): string {
  const parts: string[] = []
  for (const inline of node.children) {
    parts.push(visitInline(inline))
  }
  return parts.join('')
}

function visitInline(node: InlineNode): string {
  switch (node.type) {
    case 'text':
      return node.text
    case 'mention':
      return node.label
    case 'link': {
      const inner: string[] = []
      for (const child of node.children) {
        inner.push(child.text)
      }
      return inner.join('')
    }
    case 'linebreak':
      return '\n'
  }
}

function visitList(list: ListNode, out: string[]): void {
  for (const item of list.children) {
    visitListItem(item, out)
  }
}

function visitListItem(item: ListItemNode, out: string[]): void {
  const inlineParts: string[] = []
  for (const child of item.children) {
    if (child.type === 'list') {
      // Push lo acumulado del item, luego desciende.
      if (inlineParts.length > 0) {
        out.push(inlineParts.join(''))
        inlineParts.length = 0
      }
      visitList(child, out)
    } else {
      inlineParts.push(visitInline(child))
    }
  }
  if (inlineParts.length > 0) {
    out.push(inlineParts.join(''))
  }
}
