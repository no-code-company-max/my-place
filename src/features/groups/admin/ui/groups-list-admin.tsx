'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { PermissionGroup } from '@/features/groups/domain/types'
import { GroupFormSheet } from './group-form-sheet'

type Props = {
  /** Slug del place — alimenta el Link a `/settings/groups/[groupId]`
   *  (URL pública subdominio: el path NO incluye placeSlug — vive en el
   *  subdominio del browser). También se pasa al `<GroupFormSheet>` en
   *  modo create. */
  placeSlug: string
  /** Grupos del place — preset arriba, después por createdAt asc.
   *  Cada uno se renderea como row minimalista enlazada a su detalle. */
  groups: ReadonlyArray<PermissionGroup>
}

/**
 * Lista admin de grupos. Client Component porque cablea el sheet "Nuevo
 * grupo" inline (mismo patrón que `<LibraryCategoriesPanel>` del slice
 * `library`).
 *
 * Cada row muestra SÓLO:
 *  - nombre + chip "preset" (si aplica)
 *  - count de miembros
 *  - chevron ›
 *
 * Tap en la row → navega a `/settings/groups/{groupId}` (page detalle
 * con toda la info y acciones). Esto resuelve el overflow del diseño
 * anterior en mobile (360px) — el listado vivía con todos los permisos
 * y scope inline, generando scroll infinito desde 2 grupos.
 *
 * Botón "+ Nuevo grupo" = dashed-border full-width DEBAJO de la lista,
 * según el patrón canónico de `docs/ux-patterns.md` ("+ add affordance
 * is dashed-border bottom-of-list, not a top-right filled button").
 *
 * Empty state secundario (cuando sólo está el preset) lo agrega la page
 * padre debajo — este componente no lo renderiza para no acoplar.
 */
export function GroupsListAdmin({ placeSlug, groups }: Props): React.ReactNode {
  const [sheetOpen, setSheetOpen] = useState(false)

  // `placeSlug` viaja al `GroupFormSheet` en modo create. Reusamos el
  // mismo identifier para no inflar la API.
  void placeSlug

  return (
    <div className="space-y-3">
      {groups.length === 0 ? (
        <p className="text-sm italic text-neutral-500">Todavía no hay grupos en este place.</p>
      ) : (
        <ul className="divide-y divide-neutral-200 border-y border-neutral-200">
          {groups.map((group) => (
            <li key={group.id}>
              <Link
                href={`/settings/groups/${group.id}`}
                className="flex min-h-[56px] items-center gap-3 py-2 hover:bg-neutral-50"
                aria-label={`Abrir detalle del grupo ${group.name}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-base font-medium">{group.name}</span>
                    {group.isPreset ? (
                      <span className="shrink-0 rounded-full border border-amber-300 px-2 py-0.5 text-[11px] text-amber-700">
                        preset
                      </span>
                    ) : null}
                  </div>
                </div>
                <span className="shrink-0 text-xs text-neutral-600">
                  {group.memberCount} {group.memberCount === 1 ? 'miembro' : 'miembros'}
                </span>
                <svg
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0 text-neutral-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md border border-dashed border-neutral-300 px-4 text-sm font-medium text-neutral-600 hover:border-neutral-500"
      >
        <span aria-hidden="true">+</span> Nuevo grupo
      </button>

      <GroupFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        mode={{ kind: 'create', placeSlug }}
      />
    </div>
  )
}
