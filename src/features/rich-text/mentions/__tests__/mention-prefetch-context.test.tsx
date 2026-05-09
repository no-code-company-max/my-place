import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
  MentionPrefetchContext,
  useMentionPrefetchSource,
  type MentionPrefetchValue,
} from '../ui/mention-prefetch-context'

/**
 * Validación mínima del hook: el plugin debe poder renderizar tanto
 * dentro como fuera de un Provider sin throw. El comportamiento legacy
 * (prefetch propio + fetch live) depende de que el hook retorne `null`
 * cuando no hay Provider arriba.
 */
describe('useMentionPrefetchSource', () => {
  it('retorna null cuando se llama fuera de cualquier Provider', () => {
    const { result } = renderHook(() => useMentionPrefetchSource())
    expect(result.current).toBeNull()
  })

  it('retorna el value del Provider cuando está montado', () => {
    const value: MentionPrefetchValue = {
      users: [{ userId: 'u1', displayName: 'Ada', handle: null }],
      events: [],
      categories: null,
      refresh: async () => {},
      lastFetchedAt: 1234,
    }
    const { result } = renderHook(() => useMentionPrefetchSource(), {
      wrapper: ({ children }) => (
        <MentionPrefetchContext.Provider value={value}>{children}</MentionPrefetchContext.Provider>
      ),
    })
    expect(result.current).toBe(value)
    expect(result.current?.users).toHaveLength(1)
    expect(result.current?.events).toEqual([])
    expect(result.current?.categories).toBeNull()
    expect(result.current?.lastFetchedAt).toBe(1234)
  })
})
