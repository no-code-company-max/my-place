import { describe, expect, it } from 'vitest'
import { friendlyErrorMessage } from '../ui/utils'
import { DomainError } from '@/shared/errors/domain-error'

/**
 * Test específico para el discriminador de `EditSessionInvalid` en el helper
 * de UI. La clase real vive en `shared/lib/edit-session-token.ts` con
 * `import 'server-only'`, así que NO podemos instanciarla acá sin romper el
 * bundle cliente del test runner. En su lugar simulamos el shape: una
 * subclase de DomainError con `name = 'EditSessionInvalid'` y `context.reason`.
 *
 * Ver `friendlyErrorMessage` línea ~40 — discriminación por shape, mismo
 * patrón que SlugCollisionExhausted.
 */
class FakeEditSessionInvalid extends DomainError {
  override name = 'EditSessionInvalid'
  constructor(reason: 'expired' | 'bad_signature' | 'malformed') {
    super('AUTHORIZATION', 'Sesión de edición inválida.', { reason })
  }
}

describe('friendlyErrorMessage — Audit #1: EditSessionInvalid copy específico', () => {
  it('reason="expired" → mensaje claro con CTA "abrí el editor de nuevo"', () => {
    const msg = friendlyErrorMessage(new FakeEditSessionInvalid('expired'))
    expect(msg).toContain('La sesión de edición venció')
    expect(msg).toContain('abrir el editor')
  })

  it('reason="bad_signature" → mensaje "no es válida" con misma CTA', () => {
    const msg = friendlyErrorMessage(new FakeEditSessionInvalid('bad_signature'))
    expect(msg).toContain('La sesión de edición no es válida')
    expect(msg).toContain('abrir el editor')
  })

  it('reason="malformed" → cae al mismo "no es válida"', () => {
    const msg = friendlyErrorMessage(new FakeEditSessionInvalid('malformed'))
    expect(msg).toContain('La sesión de edición no es válida')
  })

  it('SIN discriminador → no caería al fallback "Algo no salió bien"', () => {
    // Regression guard: si alguien refactoreara y removiera el branch
    // EditSessionInvalid, el error caería al fallback genérico — este test
    // garantiza que NO retornamos el mensaje fallback para este shape.
    const msg = friendlyErrorMessage(new FakeEditSessionInvalid('expired'))
    expect(msg).not.toContain('Algo no salió bien')
  })
})
