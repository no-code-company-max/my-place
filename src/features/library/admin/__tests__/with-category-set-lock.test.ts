import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { acquireCategorySetLock } from '@/features/library/admin/server/actions/_with-category-set-lock'

describe('acquireCategorySetLock', () => {
  it('llama tx.$executeRaw con pg_advisory_xact_lock parametrizado por placeId', async () => {
    const executeRaw = vi.fn().mockResolvedValue(1)
    const tx = { $executeRaw: executeRaw } as unknown as Parameters<
      typeof acquireCategorySetLock
    >[0]

    await acquireCategorySetLock(tx, 'place-123')

    expect(executeRaw).toHaveBeenCalledTimes(1)
    // El primer argumento es un objeto `Sql` de Prisma. Inspeccionamos su
    // shape: `strings` (template parts) + `values` (interpolaciones). El SQL
    // emitido contiene `pg_advisory_xact_lock`, namespace fijo (1) y un
    // segundo placeholder con el placeId via `hashtext`.
    const sqlArg = executeRaw.mock.calls[0]?.[0] as { strings: string[]; values: unknown[] }
    const fullText = sqlArg.strings.join('?')
    expect(fullText).toContain('pg_advisory_xact_lock')
    expect(fullText).toContain('hashtext')
    expect(sqlArg.values).toEqual([1, 'place-123'])
  })

  it('propaga el error si executeRaw falla (ej: pool agotado)', async () => {
    const executeRaw = vi.fn().mockRejectedValue(new Error('connection terminated'))
    const tx = { $executeRaw: executeRaw } as unknown as Parameters<
      typeof acquireCategorySetLock
    >[0]

    await expect(acquireCategorySetLock(tx, 'place-1')).rejects.toThrow('connection terminated')
  })
})
