import { describe, expect, it } from 'vitest'
import {
  PREREQ_CHAIN_MAX_DEPTH,
  validateNoCycle,
  type ItemForCycleCheck,
} from '../domain/prereq-validation'

/**
 * Tests para `validateNoCycle` (G.3.a).
 *
 * Cubre las variantes del riesgo "validación de ciclos en prereqs es
 * app-layer" del plan + ADR D4. BFS lineal, max depth 50 defensivo.
 */

function buildLookup(
  entries: ReadonlyArray<readonly [string, string | null]>,
): ReadonlyMap<string, ItemForCycleCheck> {
  const map = new Map<string, ItemForCycleCheck>()
  for (const [id, prereq] of entries) {
    map.set(id, { prereqItemId: prereq })
  }
  return map
}

describe('validateNoCycle — autoreferencia (input degenerado)', () => {
  it('itemId === candidatePrereqId → ciclo directo → false', () => {
    const lookup = buildLookup([['A', null]])
    expect(validateNoCycle('A', 'A', lookup)).toBe(false)
  })
})

describe('validateNoCycle — cadenas válidas', () => {
  it('candidate sin prereq → seguro → true', () => {
    // Asignar B como prereq de A; B no tiene prereq → cadena de longitud 1, sin ciclo.
    const lookup = buildLookup([
      ['A', null],
      ['B', null],
    ])
    expect(validateNoCycle('A', 'B', lookup)).toBe(true)
  })

  it('cadena lineal profunda sin ciclo → true', () => {
    // D ← C ← B ← A — asignar D como prereq de E; chain D→C→B→A→null.
    const lookup = buildLookup([
      ['A', null],
      ['B', 'A'],
      ['C', 'B'],
      ['D', 'C'],
      ['E', null],
    ])
    expect(validateNoCycle('E', 'D', lookup)).toBe(true)
  })

  it('candidate inexistente en lookup → tratado como sin chain → true', () => {
    // E no existe en el lookup; el caller validó existencia por separado.
    const lookup = buildLookup([['A', null]])
    expect(validateNoCycle('A', 'E', lookup)).toBe(true)
  })
})

describe('validateNoCycle — ciclos detectados', () => {
  it('ciclo indirecto A→B→A → asignar B a A forma ciclo → false', () => {
    // Estado actual: B → A (B tiene como prereq a A). Si ahora asignamos
    // A.prereq = B, formamos ciclo A→B→A.
    const lookup = buildLookup([
      ['A', null],
      ['B', 'A'],
    ])
    expect(validateNoCycle('A', 'B', lookup)).toBe(false)
  })

  it('ciclo profundo A→B→C→D→A → asignar D a A → false', () => {
    // Estado actual: B→A, C→B, D→C. Si A.prereq = D, ciclo A→D→C→B→A.
    const lookup = buildLookup([
      ['A', null],
      ['B', 'A'],
      ['C', 'B'],
      ['D', 'C'],
    ])
    expect(validateNoCycle('A', 'D', lookup)).toBe(false)
  })

  it('ciclo de 3 nodos A→B→C→A → asignar C a A → false', () => {
    const lookup = buildLookup([
      ['A', null],
      ['B', 'A'],
      ['C', 'B'],
    ])
    expect(validateNoCycle('A', 'C', lookup)).toBe(false)
  })
})

describe('validateNoCycle — cap defensivo de profundidad', () => {
  it(`cadena ≥${PREREQ_CHAIN_MAX_DEPTH} niveles → false (data corrupta defensivo)`, () => {
    // Construimos una cadena lineal extra-larga: i_0←i_1←i_2←...←i_60.
    // Asignar i_0 como prereq de un nuevo item NEW; i_0 no tiene prereq
    // pero la cadena es legítima — no hay ciclo. Sin embargo, validamos
    // el caso pathológico: chain real-world > 50 niveles. Construyo un
    // caso donde el chain efectivo a recorrer supere el cap (cadena que
    // arranca en el candidate y baja).
    const total = PREREQ_CHAIN_MAX_DEPTH + 5
    const entries: Array<[string, string | null]> = []
    for (let i = 0; i < total; i += 1) {
      const id = `n-${i}`
      const prereq = i === 0 ? null : `n-${i - 1}`
      entries.push([id, prereq])
    }
    const lookup = buildLookup(entries)
    // Asignar n-${total-1} como prereq de un item NUEVO ("NEW") fuera del
    // lookup → al recorrer el chain bajamos por todos los n-* hasta el cap.
    expect(validateNoCycle('NEW', `n-${total - 1}`, lookup)).toBe(false)
  })

  it('cadena de longitud MAX exactamente → true (no triggea cap, recorre depth 0..MAX-1)', () => {
    // El cap dispara cuando depth ≥ MAX. Una cadena legit de exactamente
    // MAX nodos itera hasta depth = MAX-1 (cuando llega a null) y termina
    // sin disparar el cap → válida.
    const total = PREREQ_CHAIN_MAX_DEPTH
    const entries: Array<[string, string | null]> = []
    for (let i = 0; i < total; i += 1) {
      const id = `n-${i}`
      const prereq = i === 0 ? null : `n-${i - 1}`
      entries.push([id, prereq])
    }
    const lookup = buildLookup(entries)
    expect(validateNoCycle('NEW', `n-${total - 1}`, lookup)).toBe(true)
  })

  it('cadena corta (depth < MAX) → no triggea cap', () => {
    // Caso negativo de control: una cadena de 5 niveles es claramente legit.
    const entries: Array<[string, string | null]> = []
    for (let i = 0; i < 5; i += 1) {
      const id = `n-${i}`
      const prereq = i === 0 ? null : `n-${i - 1}`
      entries.push([id, prereq])
    }
    const lookup = buildLookup(entries)
    expect(validateNoCycle('NEW', 'n-4', lookup)).toBe(true)
  })
})
