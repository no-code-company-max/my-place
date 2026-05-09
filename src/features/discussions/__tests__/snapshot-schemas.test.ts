import { describe, expect, it } from 'vitest'
import { ValidationError } from '@/shared/errors/domain-error'
import {
  assertSnapshot,
  authorSnapshotSchema,
  quoteSnapshotSchema,
} from '../domain/snapshot-schemas'

describe('snapshot-schemas — Audit #5: validación pre-insert de JSONB', () => {
  describe('authorSnapshotSchema', () => {
    it('acepta shape válido (displayName + avatarUrl null)', () => {
      const valid = { displayName: 'Ada', avatarUrl: null }
      expect(() => assertSnapshot(valid, authorSnapshotSchema)).not.toThrow()
      expect(assertSnapshot(valid, authorSnapshotSchema)).toBe(valid)
    })

    it('acepta avatarUrl con string', () => {
      const valid = { displayName: 'Ada', avatarUrl: 'https://x.com/a.png' }
      expect(() => assertSnapshot(valid, authorSnapshotSchema)).not.toThrow()
    })

    it('rechaza displayName vacío', () => {
      const invalid = { displayName: '', avatarUrl: null }
      expect(() => assertSnapshot(invalid, authorSnapshotSchema)).toThrow(ValidationError)
    })

    it('rechaza shape sin displayName', () => {
      const invalid = { avatarUrl: null } as unknown
      expect(() => assertSnapshot(invalid, authorSnapshotSchema)).toThrow(ValidationError)
    })

    it('rechaza Function en lugar de string (regresion guard del audit)', () => {
      // Si alguien refactorea buildAuthorSnapshot y mete una function, Prisma lo
      // serializaría como `{}` o tiraría opaco — acá lo cazamos antes.
      const invalid = { displayName: () => 'Ada', avatarUrl: null } as unknown
      expect(() => assertSnapshot(invalid, authorSnapshotSchema)).toThrow(ValidationError)
    })
  })

  describe('quoteSnapshotSchema', () => {
    it('acepta shape válido con createdAt Date', () => {
      const valid = {
        commentId: 'c-1',
        authorLabel: 'Ada',
        bodyExcerpt: 'hola',
        createdAt: new Date(),
      }
      expect(() => assertSnapshot(valid, quoteSnapshotSchema)).not.toThrow()
    })

    it('rechaza createdAt como string ISO (Prisma serializa, pero in-memory debe ser Date)', () => {
      const invalid = {
        commentId: 'c-1',
        authorLabel: 'Ada',
        bodyExcerpt: 'hola',
        createdAt: '2026-05-09T00:00:00Z',
      } as unknown
      expect(() => assertSnapshot(invalid, quoteSnapshotSchema)).toThrow(ValidationError)
    })

    it('rechaza commentId vacío', () => {
      const invalid = {
        commentId: '',
        authorLabel: 'Ada',
        bodyExcerpt: 'hola',
        createdAt: new Date(),
      }
      expect(() => assertSnapshot(invalid, quoteSnapshotSchema)).toThrow(ValidationError)
    })
  })

  describe('assertSnapshot helper', () => {
    it('throw incluye context.issues con paths exactos del campo inválido', () => {
      const invalid = { displayName: '', avatarUrl: null }
      try {
        assertSnapshot(invalid, authorSnapshotSchema)
        throw new Error('expected to throw')
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError)
        const ctx = (err as ValidationError).context as { issues: Array<{ path: string[] }> }
        expect(ctx.issues).toBeDefined()
        expect(ctx.issues[0]?.path).toContain('displayName')
      }
    })

    it('mensaje del error es genérico (no expone shape interno al cliente)', () => {
      const invalid = { displayName: '' }
      try {
        assertSnapshot(invalid, authorSnapshotSchema)
        throw new Error('expected to throw')
      } catch (err) {
        expect((err as ValidationError).message).toBe('Snapshot inválido para persistir.')
      }
    })
  })
})
