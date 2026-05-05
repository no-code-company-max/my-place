'use client'

import dynamic from 'next/dynamic'
import type { ComponentProps } from 'react'
import type { PostComposer } from '@/features/discussions/public'

/**
 * Wrapper client-side de `<PostComposer>` con carga diferida.
 *
 * Razón: el composer trae el editor TipTap (~190KB gz). Sólo lo necesita
 * la page de crear/editar conversación, así que usamos `next/dynamic`
 * con `ssr: false` para que no pese en el first-load JS de pages que
 * sólo listan o leen.
 *
 * `ssr: false` requiere que la importación viva en un Client Component:
 * Next 15 prohíbe `dynamic({ ssr: false })` desde Server Components.
 * Por eso este file lleva `'use client'` y la page lo importa como
 * componente regular.
 */
const PostComposerInner = dynamic(
  () => import('@/features/discussions/public').then((m) => ({ default: m.PostComposer })),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 animate-pulse rounded-md bg-soft" aria-label="Cargando editor" />
    ),
  },
)

type PostComposerProps = ComponentProps<typeof PostComposer>

export function PostComposerLazy(props: PostComposerProps): React.ReactNode {
  return <PostComposerInner {...props} />
}
