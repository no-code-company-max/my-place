'use client'

import dynamic from 'next/dynamic'
import type { ComponentProps } from 'react'
import type { LibraryItemForm } from '@/features/library/public'

/**
 * Wrapper client-side de `<LibraryItemForm>` con carga diferida.
 *
 * Razón: el form trae el editor TipTap (~190KB gz). Sólo lo necesitan
 * las pages de crear/editar item; el browse y los listings no.
 * Usamos `next/dynamic` con `ssr: false` para sacarlo del first-load JS
 * de cualquier ruta que no monte el form.
 *
 * `ssr: false` requiere que la importación viva en un Client Component:
 * Next 15 prohíbe `dynamic({ ssr: false })` desde Server Components.
 * Por eso este file lleva `'use client'` y las pages lo importan como
 * componente regular.
 */
const LibraryItemFormInner = dynamic(
  () => import('@/features/library/public').then((m) => ({ default: m.LibraryItemForm })),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 animate-pulse rounded-md bg-soft" aria-label="Cargando editor" />
    ),
  },
)

type LibraryItemFormProps = ComponentProps<typeof LibraryItemForm>

export function LibraryItemFormLazy(props: LibraryItemFormProps): React.ReactNode {
  return <LibraryItemFormInner {...props} />
}
