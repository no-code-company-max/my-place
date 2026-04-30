import { describe, expect, it } from 'vitest'
import { POST_LIST_FILTERS, parsePostListFilter, postListFilterSchema } from '../domain/filter'

describe('POST_LIST_FILTERS', () => {
  it('contiene los 3 valores canónicos en orden', () => {
    expect(POST_LIST_FILTERS).toEqual(['all', 'unanswered', 'participating'])
  })
})

describe('postListFilterSchema', () => {
  it('acepta cada valor canónico', () => {
    expect(postListFilterSchema.parse('all')).toBe('all')
    expect(postListFilterSchema.parse('unanswered')).toBe('unanswered')
    expect(postListFilterSchema.parse('participating')).toBe('participating')
  })

  it('cae a "all" silenciosamente cuando el input es inválido (catch)', () => {
    expect(postListFilterSchema.parse('mine')).toBe('all')
    expect(postListFilterSchema.parse('')).toBe('all')
    expect(postListFilterSchema.parse('UNANSWERED')).toBe('all')
  })
})

describe('parsePostListFilter', () => {
  it('null → "all"', () => {
    expect(parsePostListFilter(null)).toBe('all')
  })

  it('undefined → "all"', () => {
    expect(parsePostListFilter(undefined)).toBe('all')
  })

  it('valor canónico → mismo valor', () => {
    expect(parsePostListFilter('all')).toBe('all')
    expect(parsePostListFilter('unanswered')).toBe('unanswered')
    expect(parsePostListFilter('participating')).toBe('participating')
  })

  it('valor inválido → "all" (URL manual editada)', () => {
    expect(parsePostListFilter('mine')).toBe('all')
    expect(parsePostListFilter('xss-attempt')).toBe('all')
  })
})
