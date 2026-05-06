/**
 * Test del contrato de tipos del Lexical AST.
 *
 * No es runtime — sólo verifica que un literal con shape canónico typecheckee
 * como `LexicalDocument`. Si los tipos del slice se desincronizan del shape
 * que `editor.toJSON()` produce en runtime, este test rompe en typecheck.
 */

import { describe, it } from 'vitest'
import type {
  CommentDocument,
  EmbedNode,
  HeadingNode,
  LexicalDocument,
  LineBreakNode,
  LinkNode,
  ListItemNode,
  ListNode,
  MentionNode,
  ParagraphNode,
  PostDocument,
  QuoteSnapshot,
  RootNode,
  TextNode,
  YoutubeEmbed,
} from '../types'

describe('Lexical AST types', () => {
  it('compila: documento canónico vacío', () => {
    const _doc: LexicalDocument = {
      root: {
        type: 'root',
        version: 1,
        format: '',
        indent: 0,
        direction: null,
        children: [],
      },
    }
    void _doc
  })

  it('compila: paragraph con texto bold', () => {
    const text: TextNode = {
      type: 'text',
      version: 1,
      text: 'hola',
      format: 1,
      detail: 0,
      mode: 'normal',
      style: '',
    }
    const para: ParagraphNode = {
      type: 'paragraph',
      version: 1,
      format: '',
      indent: 0,
      direction: 'ltr',
      textFormat: 0,
      textStyle: '',
      children: [text],
    }
    const root: RootNode = {
      type: 'root',
      version: 1,
      format: '',
      indent: 0,
      direction: 'ltr',
      children: [para],
    }
    const _doc: LexicalDocument = { root }
    void _doc
  })

  it('compila: heading h1 con link', () => {
    const link: LinkNode = {
      type: 'link',
      version: 1,
      url: 'https://example.com',
      rel: null,
      target: null,
      title: null,
      format: '',
      indent: 0,
      direction: null,
      children: [
        {
          type: 'text',
          version: 1,
          text: 'click',
          format: 0,
          detail: 0,
          mode: 'normal',
          style: '',
        },
      ],
    }
    const heading: HeadingNode = {
      type: 'heading',
      version: 1,
      tag: 'h1',
      format: '',
      indent: 0,
      direction: 'ltr',
      children: [link],
    }
    void heading
  })

  it('compila: lista anidada', () => {
    const item: ListItemNode = {
      type: 'listitem',
      version: 1,
      value: 1,
      format: '',
      indent: 0,
      direction: 'ltr',
      children: [],
    }
    const list: ListNode = {
      type: 'list',
      version: 1,
      listType: 'bullet',
      start: 1,
      tag: 'ul',
      format: '',
      indent: 0,
      direction: 'ltr',
      children: [item],
    }
    void list
  })

  it('compila: mention polimórfico', () => {
    const userMention: MentionNode = {
      type: 'mention',
      version: 1,
      kind: 'user',
      targetId: 'usr_1',
      targetSlug: 'max',
      label: 'Max',
      placeId: 'place_1',
    }
    const eventMention: MentionNode = {
      type: 'mention',
      version: 1,
      kind: 'event',
      targetId: 'evt_1',
      targetSlug: 'asado-de-junio',
      label: 'Asado de junio',
      placeId: 'place_1',
    }
    void userMention
    void eventMention
  })

  it('compila: line break', () => {
    const br: LineBreakNode = { type: 'linebreak', version: 1 }
    void br
  })

  it('compila: youtube embed', () => {
    const yt: YoutubeEmbed = { type: 'youtube', version: 1, videoId: 'abc' }
    const embed: EmbedNode = yt
    void embed
  })

  it('compila: aliases por surface', () => {
    const empty: LexicalDocument = {
      root: {
        type: 'root',
        version: 1,
        format: '',
        indent: 0,
        direction: null,
        children: [],
      },
    }
    const c: CommentDocument = empty
    const p: PostDocument = empty
    void c
    void p
  })

  it('compila: QuoteSnapshot', () => {
    const empty: LexicalDocument = {
      root: {
        type: 'root',
        version: 1,
        format: '',
        indent: 0,
        direction: null,
        children: [],
      },
    }
    const snap: QuoteSnapshot = {
      authorLabel: 'Max',
      excerpt: 'hola',
      body: empty,
      sourceLabel: 'Pan de campo',
    }
    void snap
  })
})
