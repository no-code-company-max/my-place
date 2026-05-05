import { describe, expect, it } from 'vitest'
import { ValidationError } from '@/shared/errors/domain-error'
import {
  CATEGORY_TITLE_MAX_LENGTH,
  ITEM_COVER_URL_MAX_LENGTH,
  MAX_CATEGORIES_PER_PLACE,
  assertCategoryCapacity,
  validateCategoryEmoji,
  validateCategorySlug,
  validateCategoryTitle,
  validateContributionPolicy,
  validateItemCoverUrl,
} from '../domain/invariants'
import { CategoryLimitReachedError } from '../domain/errors'

describe('library invariants — categoría', () => {
  describe('validateCategoryTitle', () => {
    it('acepta título normal', () => {
      expect(() => validateCategoryTitle('Recetas')).not.toThrow()
    })

    it('rechaza título vacío post-trim', () => {
      expect(() => validateCategoryTitle('   ')).toThrow(ValidationError)
    })

    it(`rechaza título > ${CATEGORY_TITLE_MAX_LENGTH} chars`, () => {
      expect(() => validateCategoryTitle('a'.repeat(CATEGORY_TITLE_MAX_LENGTH + 1))).toThrow(
        ValidationError,
      )
    })
  })

  describe('validateCategoryEmoji', () => {
    it('acepta emoji simple', () => {
      expect(() => validateCategoryEmoji('🍳')).not.toThrow()
    })

    it('acepta emoji compuesto (familia ZWJ)', () => {
      expect(() => validateCategoryEmoji('👨‍👩‍👧')).not.toThrow()
    })

    it('rechaza emoji vacío', () => {
      expect(() => validateCategoryEmoji('')).toThrow(ValidationError)
    })

    it('rechaza string > 8 chars', () => {
      expect(() => validateCategoryEmoji('🍳🍳🍳🍳🍳')).toThrow(ValidationError)
    })
  })

  describe('validateCategorySlug', () => {
    it('acepta slugs kebab-case válidos', () => {
      expect(() => validateCategorySlug('recetas')).not.toThrow()
      expect(() => validateCategorySlug('mi-categoria')).not.toThrow()
      expect(() => validateCategorySlug('cat-123')).not.toThrow()
    })

    it('rechaza espacios', () => {
      expect(() => validateCategorySlug('mi categoria')).toThrow(ValidationError)
    })

    it('rechaza acentos / mayúsculas', () => {
      expect(() => validateCategorySlug('Recetas')).toThrow(ValidationError)
      expect(() => validateCategorySlug('cocción')).toThrow(ValidationError)
    })

    it('rechaza guiones consecutivos / leading / trailing', () => {
      expect(() => validateCategorySlug('-recetas')).toThrow(ValidationError)
      expect(() => validateCategorySlug('recetas-')).toThrow(ValidationError)
      expect(() => validateCategorySlug('rec--etas')).toThrow(ValidationError)
    })

    it('rechaza vacío', () => {
      expect(() => validateCategorySlug('')).toThrow(ValidationError)
    })
  })

  describe('validateContributionPolicy', () => {
    it('acepta los 3 valores válidos', () => {
      expect(() => validateContributionPolicy('DESIGNATED')).not.toThrow()
      expect(() => validateContributionPolicy('MEMBERS_OPEN')).not.toThrow()
      expect(() => validateContributionPolicy('SELECTED_GROUPS')).not.toThrow()
    })

    it('rechaza valor inventado', () => {
      expect(() => validateContributionPolicy('PUBLIC')).toThrow(ValidationError)
    })

    it('rechaza ADMIN_ONLY (eliminado en migration 20260504010000)', () => {
      expect(() => validateContributionPolicy('ADMIN_ONLY')).toThrow(ValidationError)
    })
  })

  describe('assertCategoryCapacity', () => {
    it(`acepta ${MAX_CATEGORIES_PER_PLACE - 1}`, () => {
      expect(() => assertCategoryCapacity(MAX_CATEGORIES_PER_PLACE - 1)).not.toThrow()
    })

    it(`rechaza exactamente ${MAX_CATEGORIES_PER_PLACE}`, () => {
      expect(() => assertCategoryCapacity(MAX_CATEGORIES_PER_PLACE)).toThrow(
        CategoryLimitReachedError,
      )
    })

    it('rechaza más', () => {
      expect(() => assertCategoryCapacity(MAX_CATEGORIES_PER_PLACE + 5)).toThrow(
        CategoryLimitReachedError,
      )
    })
  })

  describe('validateItemCoverUrl', () => {
    it('acepta null / undefined / string vacío', () => {
      expect(() => validateItemCoverUrl(null)).not.toThrow()
      expect(() => validateItemCoverUrl(undefined)).not.toThrow()
      expect(() => validateItemCoverUrl('')).not.toThrow()
      expect(() => validateItemCoverUrl('   ')).not.toThrow()
    })

    it('acepta URLs http(s) válidas', () => {
      expect(() => validateItemCoverUrl('https://example.com/cover.jpg')).not.toThrow()
      expect(() => validateItemCoverUrl('http://localhost:3000/img.png')).not.toThrow()
    })

    it('rechaza schemes no http/https', () => {
      expect(() => validateItemCoverUrl('javascript:alert(1)')).toThrow(ValidationError)
      expect(() => validateItemCoverUrl('data:image/png;base64,abc')).toThrow(ValidationError)
      expect(() => validateItemCoverUrl('ftp://example.com/x')).toThrow(ValidationError)
    })

    it(`rechaza URL > ${ITEM_COVER_URL_MAX_LENGTH} chars`, () => {
      const long = 'https://example.com/' + 'x'.repeat(ITEM_COVER_URL_MAX_LENGTH)
      expect(() => validateItemCoverUrl(long)).toThrow(ValidationError)
    })
  })
})
