import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// El hook por default construye un `SupabaseBroadcastSubscriber` con el
// browser client. En tests inyectamos un `FakeBroadcastSubscriber`; además
// evitamos que el import de `createSupabaseBrowser` dispare el parse de env.
vi.mock('@/shared/config/env', () => ({
  clientEnv: {
    NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
  },
}))

import { FakeBroadcastSubscriber } from '@/shared/lib/realtime/client'
import type { CommentView } from '../server/queries'
import {
  __resetCommentRealtimeSubscriberForTests,
  __setCommentRealtimeSubscriberForTests,
  useCommentRealtime,
} from '../ui/use-comment-realtime'

function makeComment(id: string, overrides: Partial<CommentView> = {}): CommentView {
  return {
    id,
    postId: 'post-1',
    placeId: 'place-1',
    authorUserId: 'user-' + id,
    authorSnapshot: { displayName: 'Max', avatarUrl: null },
    body: {
      root: {
        type: 'root',
        version: 1,
        format: '',
        indent: 0,
        direction: null,
        children: [
          {
            type: 'paragraph',
            version: 1,
            format: '',
            indent: 0,
            direction: 'ltr',
            textFormat: 0,
            textStyle: '',
            children: [],
          },
        ],
      },
    },
    quotedCommentId: null,
    quotedSnapshot: null,
    createdAt: new Date('2026-04-22T12:00:00Z'),
    editedAt: null,
    deletedAt: null,
    version: 0,
    ...overrides,
  }
}

describe('useCommentRealtime', () => {
  let fake: FakeBroadcastSubscriber

  beforeEach(() => {
    fake = new FakeBroadcastSubscriber()
    __setCommentRealtimeSubscriberForTests(fake)
  })

  afterEach(() => {
    __resetCommentRealtimeSubscriberForTests()
  })

  it('appendea comment recibido por broadcast al estado local', () => {
    const { result } = renderHook(() => useCommentRealtime({ postId: 'post-1', initialItems: [] }))
    expect(result.current.appendedComments).toEqual([])

    act(() => {
      fake.emit('post:post-1', 'comment_created', { comment: makeComment('c1') })
    })
    expect(result.current.appendedComments).toHaveLength(1)
    expect(result.current.appendedComments[0]!.id).toBe('c1')

    act(() => {
      fake.emit('post:post-1', 'comment_created', { comment: makeComment('c2') })
    })
    expect(result.current.appendedComments.map((c) => c.id)).toEqual(['c1', 'c2'])
  })

  it('dedupe por id: initialItems ya vistos NO se appendean', () => {
    const initial = [makeComment('c1'), makeComment('c2')]
    const { result } = renderHook(() =>
      useCommentRealtime({ postId: 'post-1', initialItems: initial }),
    )

    act(() => {
      fake.emit('post:post-1', 'comment_created', { comment: makeComment('c1') })
      fake.emit('post:post-1', 'comment_created', { comment: makeComment('c2') })
      fake.emit('post:post-1', 'comment_created', { comment: makeComment('c3') })
    })

    // Sólo c3 queda appendeado — c1 y c2 vinieron por SSR.
    expect(result.current.appendedComments.map((c) => c.id)).toEqual(['c3'])
  })

  it('dedupe: el mismo broadcast duplicado sólo se appendea una vez', () => {
    const { result } = renderHook(() => useCommentRealtime({ postId: 'post-1', initialItems: [] }))

    act(() => {
      fake.emit('post:post-1', 'comment_created', { comment: makeComment('c1') })
      fake.emit('post:post-1', 'comment_created', { comment: makeComment('c1') })
    })

    expect(result.current.appendedComments.map((c) => c.id)).toEqual(['c1'])
  })

  it('sync con initialItems cambiante: IDs nuevos SSR purgan appended y marcan seen', () => {
    const { result, rerender } = renderHook(
      ({ initialItems }) => useCommentRealtime({ postId: 'post-1', initialItems }),
      { initialProps: { initialItems: [] as CommentView[] } },
    )

    act(() => {
      fake.emit('post:post-1', 'comment_created', { comment: makeComment('c1') })
    })
    expect(result.current.appendedComments.map((c) => c.id)).toEqual(['c1'])

    // SSR revalidate entrega `c1` como initial → el hook debe sacarlo de appended
    // (si no, se renderizaría dos veces: una en SSR y otra en el wrapper).
    rerender({ initialItems: [makeComment('c1')] })
    expect(result.current.appendedComments).toEqual([])

    // Un nuevo broadcast sobre c1 ya no debe appendear (está en el Set).
    act(() => {
      fake.emit('post:post-1', 'comment_created', { comment: makeComment('c1') })
    })
    expect(result.current.appendedComments).toEqual([])
  })

  it('abre canal `post:<postId>` con event `comment_created`', () => {
    const spySubscribe = vi.spyOn(fake, 'subscribe')
    renderHook(() => useCommentRealtime({ postId: 'post-abc', initialItems: [] }))

    expect(spySubscribe).toHaveBeenCalledTimes(1)
    const [topic, event] = spySubscribe.mock.calls[0]!
    expect(topic).toBe('post:post-abc')
    expect(event).toBe('comment_created')
  })

  it('cleanup on unmount: Unsubscribe se invoca', () => {
    const unsubscribe = vi.fn()
    const fakeWithSpy = new FakeBroadcastSubscriber()
    vi.spyOn(fakeWithSpy, 'subscribe').mockReturnValue(unsubscribe)
    __setCommentRealtimeSubscriberForTests(fakeWithSpy)

    const { unmount } = renderHook(() => useCommentRealtime({ postId: 'post-1', initialItems: [] }))
    unmount()

    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('cambio de postId cierra el canal anterior y abre uno nuevo', () => {
    const spySubscribe = vi.spyOn(fake, 'subscribe')
    const { rerender } = renderHook(
      ({ postId }) => useCommentRealtime({ postId, initialItems: [] }),
      { initialProps: { postId: 'post-1' } },
    )

    expect(spySubscribe).toHaveBeenCalledTimes(1)
    expect(spySubscribe.mock.calls[0]![0]).toBe('post:post-1')

    rerender({ postId: 'post-2' })

    expect(spySubscribe).toHaveBeenCalledTimes(2)
    expect(spySubscribe.mock.calls[1]![0]).toBe('post:post-2')
  })
})
