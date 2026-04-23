import { describe, expect, it } from 'vitest'
import { FakeBroadcastSender } from './fake-sender'

describe('FakeBroadcastSender', () => {
  it('captura cada send en orden con topic, event y payload', async () => {
    const sender = new FakeBroadcastSender()

    await sender.send('post:abc', 'comment_created', { id: 'c1' })
    await sender.send('post:abc', 'comment_created', { id: 'c2' })
    await sender.send('dm:xyz', 'message', { body: 'hola' })

    expect(sender.captures).toHaveLength(3)
    expect(sender.captures[0]).toMatchObject({
      topic: 'post:abc',
      event: 'comment_created',
      payload: { id: 'c1' },
    })
    expect(sender.captures[1]).toMatchObject({
      topic: 'post:abc',
      event: 'comment_created',
      payload: { id: 'c2' },
    })
    expect(sender.captures[2]).toMatchObject({
      topic: 'dm:xyz',
      event: 'message',
      payload: { body: 'hola' },
    })
  })

  it('lastCapture devuelve el último o null si no hay', async () => {
    const sender = new FakeBroadcastSender()
    expect(sender.lastCapture).toBeNull()

    await sender.send('t1', 'e1', { a: 1 })
    await sender.send('t2', 'e2', { b: 2 })

    expect(sender.lastCapture).toMatchObject({ topic: 't2', event: 'e2' })
  })

  it('reset limpia captures', async () => {
    const sender = new FakeBroadcastSender()
    await sender.send('t', 'e', {})
    sender.reset()
    expect(sender.captures).toEqual([])
    expect(sender.lastCapture).toBeNull()
  })

  it('send resuelve a void (best-effort, no throw)', async () => {
    const sender = new FakeBroadcastSender()
    await expect(sender.send('t', 'e', {})).resolves.toBeUndefined()
  })

  it('modo failMode simula error del transport (sender real haría log+swallow)', async () => {
    const sender = new FakeBroadcastSender({ failMode: true })
    // El fake expone el modo falla para testear el swallow en callers upstream
    // (ej: `broadcastNewComment` debe tragar y no propagar).
    await expect(sender.send('t', 'e', {})).rejects.toThrow(/fake.*fail/i)
  })
})
