import { describe, expect, it, vi } from 'vitest'
import { FakeBroadcastSubscriber } from './fake-subscriber'

describe('FakeBroadcastSubscriber', () => {
  it('emit dispara handlers registrados con el payload tipado', () => {
    const sub = new FakeBroadcastSubscriber()
    const handler = vi.fn()
    sub.subscribe<{ id: string }>('post:1', 'comment_created', handler)

    sub.emit('post:1', 'comment_created', { id: 'c1' })
    sub.emit('post:1', 'comment_created', { id: 'c2' })

    expect(handler).toHaveBeenCalledTimes(2)
    expect(handler).toHaveBeenNthCalledWith(1, { id: 'c1' })
    expect(handler).toHaveBeenNthCalledWith(2, { id: 'c2' })
  })

  it('emit sólo dispara los handlers del topic+event exactos', () => {
    const sub = new FakeBroadcastSubscriber()
    const handlerA = vi.fn()
    const handlerB = vi.fn()
    const handlerOther = vi.fn()

    sub.subscribe('post:1', 'comment_created', handlerA)
    sub.subscribe('post:2', 'comment_created', handlerB)
    sub.subscribe('post:1', 'other_event', handlerOther)

    sub.emit('post:1', 'comment_created', { id: 'x' })

    expect(handlerA).toHaveBeenCalledTimes(1)
    expect(handlerB).not.toHaveBeenCalled()
    expect(handlerOther).not.toHaveBeenCalled()
  })

  it('múltiples handlers en el mismo topic+event se disparan en orden de registro', () => {
    const sub = new FakeBroadcastSubscriber()
    const order: string[] = []
    sub.subscribe('t', 'e', () => order.push('first'))
    sub.subscribe('t', 'e', () => order.push('second'))

    sub.emit('t', 'e', {})

    expect(order).toEqual(['first', 'second'])
  })

  it('Unsubscribe remueve sólo el handler específico', () => {
    const sub = new FakeBroadcastSubscriber()
    const kept = vi.fn()
    const removed = vi.fn()
    sub.subscribe('t', 'e', kept)
    const off = sub.subscribe('t', 'e', removed)

    off()
    sub.emit('t', 'e', {})

    expect(kept).toHaveBeenCalledTimes(1)
    expect(removed).not.toHaveBeenCalled()
  })

  it('Unsubscribe es idempotente — llamar dos veces no rompe', () => {
    const sub = new FakeBroadcastSubscriber()
    const off = sub.subscribe('t', 'e', vi.fn())
    off()
    expect(() => off()).not.toThrow()
  })

  it('emit sin handlers registrados no rompe (no-op silencioso)', () => {
    const sub = new FakeBroadcastSubscriber()
    expect(() => sub.emit('t', 'e', { a: 1 })).not.toThrow()
  })

  it('reset remueve todos los handlers', () => {
    const sub = new FakeBroadcastSubscriber()
    const handler = vi.fn()
    sub.subscribe('t', 'e', handler)

    sub.reset()
    sub.emit('t', 'e', {})

    expect(handler).not.toHaveBeenCalled()
  })
})
