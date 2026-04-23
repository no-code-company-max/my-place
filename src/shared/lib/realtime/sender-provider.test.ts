import { afterEach, describe, expect, it, vi } from 'vitest'
import { FakeBroadcastSender } from './fake-sender'
import {
  getBroadcastSender,
  isBroadcastSenderOverridden,
  resetBroadcastSender,
  setBroadcastSender,
} from './sender-provider'

// Stub del SupabaseBroadcastSender real: en el provider por default se construye
// uno, pero queremos tests deterministas que no dependan del env. Mockeamos el
// módulo para no instanciar el real.
vi.mock('./supabase-sender', () => {
  class StubSender {
    readonly kind = 'supabase-stub' as const
    async send(): Promise<void> {}
  }
  return { SupabaseBroadcastSender: StubSender }
})

describe('sender-provider', () => {
  afterEach(() => {
    resetBroadcastSender()
  })

  it('getBroadcastSender construye la impl default (SupabaseBroadcastSender) cuando no hay override', () => {
    const sender = getBroadcastSender()
    // StubSender (del mock) para validar que se tomó el path real por default.
    expect((sender as unknown as { kind: string }).kind).toBe('supabase-stub')
  })

  it('getBroadcastSender cachea la instancia en llamadas sucesivas', () => {
    const a = getBroadcastSender()
    const b = getBroadcastSender()
    expect(a).toBe(b)
  })

  it('setBroadcastSender inyecta un sender y getBroadcastSender lo devuelve', () => {
    const fake = new FakeBroadcastSender()
    setBroadcastSender(fake)
    expect(getBroadcastSender()).toBe(fake)
  })

  it('isBroadcastSenderOverridden refleja si se inyectó uno manualmente', () => {
    expect(isBroadcastSenderOverridden()).toBe(false)
    setBroadcastSender(new FakeBroadcastSender())
    expect(isBroadcastSenderOverridden()).toBe(true)
    resetBroadcastSender()
    expect(isBroadcastSenderOverridden()).toBe(false)
  })

  it('resetBroadcastSender permite que la siguiente llamada vuelva a construir el default', () => {
    const fake = new FakeBroadcastSender()
    setBroadcastSender(fake)
    expect(getBroadcastSender()).toBe(fake)

    resetBroadcastSender()
    const after = getBroadcastSender()
    expect(after).not.toBe(fake)
    expect((after as unknown as { kind: string }).kind).toBe('supabase-stub')
  })
})
