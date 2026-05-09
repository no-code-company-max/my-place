'use client'

import * as React from 'react'
import type { GenericMenuOption } from './menu-option'
import type { MenuPayload } from './mention-types'

/**
 * Menú visual del typeahead — listbox con `<li role="option">` por item.
 * Co-localiza `MentionRow` (renderer per-kind) que sólo es consumido acá.
 *
 * Extraído de `mention-plugin.tsx` durante el split por LOC.
 */
export function MentionMenu({
  options,
  selectedIndex,
  onMouseEnter,
  onClick,
}: {
  options: ReadonlyArray<GenericMenuOption>
  selectedIndex: number | null
  onMouseEnter: (idx: number) => void
  onClick: (option: GenericMenuOption) => void
}): React.JSX.Element {
  return (
    <div className="rich-text-mention-menu min-w-[280px] max-w-md overflow-hidden rounded-md border border-neutral-200 bg-white shadow-lg">
      <ul role="listbox" className="m-0 max-h-72 list-none overflow-y-auto p-0">
        {options.map((option, idx) => (
          <li
            key={option.payload.id}
            ref={option.setRefElement}
            role="option"
            tabIndex={-1}
            aria-selected={selectedIndex === idx}
            onMouseEnter={() => onMouseEnter(idx)}
            onClick={() => {
              onMouseEnter(idx)
              onClick(option)
            }}
            className={[
              'flex cursor-pointer items-center gap-2 whitespace-nowrap px-3 py-2 text-sm leading-tight',
              selectedIndex === idx ? 'bg-neutral-100' : 'bg-white hover:bg-neutral-50',
            ].join(' ')}
          >
            <MentionRow payload={option.payload} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function MentionRow({ payload }: { payload: MenuPayload }): React.JSX.Element {
  if (payload.type === 'user') {
    return (
      <>
        <span aria-hidden className="text-neutral-400">
          @
        </span>
        <span className="truncate font-medium text-neutral-900">{payload.user.displayName}</span>
        {payload.user.handle ? (
          <span className="ml-auto truncate text-xs text-neutral-500">@{payload.user.handle}</span>
        ) : null}
      </>
    )
  }
  if (payload.type === 'event') {
    return (
      <>
        <span aria-hidden>🎉</span>
        <span className="truncate text-neutral-900">{payload.event.title}</span>
      </>
    )
  }
  if (payload.type === 'library-category') {
    return (
      <>
        <span aria-hidden>📚</span>
        <span className="truncate text-neutral-900">{payload.category.name}</span>
      </>
    )
  }
  return (
    <>
      <span aria-hidden>📄</span>
      <span className="truncate text-neutral-900">{payload.item.title}</span>
    </>
  )
}
