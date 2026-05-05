'use client'

import { useState } from 'react'
import type { DayOfWeek, RecurringWindow } from '@/features/hours/domain/types'
import { DAY_ORDER } from '@/features/hours/domain/types'
import { DayRow } from './week-editor-day-row'
import { WindowSheet, type SheetState } from './week-editor-window-sheet'

/**
 * Editor de ventanas recurrentes con layout día-por-fila estilo Cal.com.
 *
 * Renderiza un `<div>` (no `<section>` con header propio) — el wrapper
 * semántico + heading lo aporta `<HoursForm>` (sección "Horario de
 * apertura" que incluye también la toggle "Abierto 24/7"). Acá solo
 * proveemos el contenido del editor.
 *
 * Sólo se renderizan rows para días que tienen al menos una ventana. Para
 * agregar un día nuevo, el usuario usa el botón "+ Añadir horario" debajo
 * de la lista, que abre un sheet con day-picker + inputs de hora.
 *
 * Cada chip de ventana es a su vez un dropdown trigger con dos acciones:
 *  - Editar (abre el sheet en modo `edit`).
 *  - Eliminar (llama `onRemove` directo, sin confirm — ya está 2 taps deep).
 *
 * El menú overflow del día (a la derecha) mantiene: agregar otra ventana al
 * mismo día y copiar a otros días.
 *
 * El alta y la edición ocurren en un `<BottomSheet>` (resuelve overflow en
 * mobile + se alinea con thumb-zone). Las ventanas NO cruzan medianoche
 * (documentado en `docs/features/hours/spec.md`); el Zod schema rechaza
 * `start >= end`.
 *
 * **API pública**: `fields`, `onAdd`, `onUpdate`, `onRemove`. El parent
 * (`<HoursForm>`) es el ÚNICO que invoca `useFieldArray({ name: 'recurring' })`
 * — esa es la fuente canónica del array. Tener dos instancias del mismo
 * `name` causa desyncs (RHF docs: "only one is effective"), que se
 * manifiestan como chips que no actualizan tras editar.
 *
 * Este archivo es el orquestador del sistema WeekEditor: maneja state
 * (`SheetState`), agrupa fields por día (`groupByDay`), implementa
 * copy-to-* y compone `<DayRow>` + `<WindowSheet>` (archivos siblings
 * `week-editor-day-row.tsx` y `week-editor-window-sheet.tsx`).
 */

export const DAY_ES: Record<DayOfWeek, string> = {
  MON: 'Lunes',
  TUE: 'Martes',
  WED: 'Miércoles',
  THU: 'Jueves',
  FRI: 'Viernes',
  SAT: 'Sábado',
  SUN: 'Domingo',
}

const WEEKDAYS: ReadonlyArray<DayOfWeek> = ['MON', 'TUE', 'WED', 'THU', 'FRI']
const WEEKEND: ReadonlyArray<DayOfWeek> = ['SAT', 'SUN']

export type IndexedWindow = RecurringWindow & { id: string; index: number }

type Props = {
  fields: Array<RecurringWindow & { id: string }>
  onAdd: (w: RecurringWindow) => void
  onUpdate: (idx: number, w: RecurringWindow) => void
  onRemove: (idx: number) => void
  /**
   * Reemplaza el array completo en una sola operación. Se usa para copy-to-*
   * (que cambia varias filas a la vez) — sin esto, esos handlers tendrían
   * que disparar N adds + M removes secuenciales, generando N+M requests
   * autosave + race condition si la DB serializa los writes mal.
   */
  onReplace: (next: RecurringWindow[]) => void
}

export function WeekEditor({ fields, onAdd, onUpdate, onRemove, onReplace }: Props) {
  const [sheet, setSheet] = useState<SheetState>({ mode: 'closed' })

  const byDay = groupByDay(fields)
  const presentDays = DAY_ORDER.filter((d) => (byDay.get(d) ?? []).length > 0)
  const missingDays = DAY_ORDER.filter((d) => (byDay.get(d) ?? []).length === 0)

  function openAdd(day: DayOfWeek) {
    setSheet({ mode: 'add', day })
  }

  function openEdit(window: IndexedWindow) {
    setSheet({
      mode: 'edit',
      day: window.day,
      index: window.index,
      start: window.start,
      end: window.end,
    })
  }

  function openAddNewDay() {
    setSheet({ mode: 'add-new-day', availableDays: missingDays })
  }

  function closeSheet() {
    setSheet({ mode: 'closed' })
  }

  function copyTo(sourceDay: DayOfWeek, targetDays: ReadonlyArray<DayOfWeek>) {
    const source = byDay.get(sourceDay) ?? []
    if (source.length === 0) return

    // Computamos el array nuevo en una sola pasada y lo enviamos via
    // `onReplace`. Esto reemplaza la versión anterior que disparaba N `onAdd`
    // + M `onRemove` secuenciales — ese patrón generaba N+M requests
    // autosave + introducía race conditions si la DB serializaba los writes
    // de forma diferente al orden esperado.
    const targetSet = new Set(targetDays.filter((d) => d !== sourceDay))

    const kept: RecurringWindow[] = fields
      .filter((w) => !targetSet.has(w.day))
      .map(({ day, start, end }) => ({ day, start, end }))

    const additions: RecurringWindow[] = []
    for (const target of targetSet) {
      for (const w of source) {
        additions.push({ day: target, start: w.start, end: w.end })
      }
    }

    onReplace([...kept, ...additions])
  }

  return (
    <div className="space-y-3">
      <p className="text-xs" style={{ color: 'var(--muted)' }}>
        Horarios que se repiten cada semana. Una ventana debe ser del mismo día (no cruza
        medianoche): para abrir hasta la 01:00 del día siguiente, agregá dos ventanas (ej. sábado
        22:00–23:59 y domingo 00:00–01:00).
      </p>

      {presentDays.length > 0 ? (
        <ul className="divide-y divide-neutral-200 border-y border-neutral-200">
          {presentDays.map((day) => (
            <DayRow
              key={day}
              day={day}
              windows={byDay.get(day) ?? []}
              onAddWindow={() => openAdd(day)}
              onEditWindow={openEdit}
              onRemoveWindow={onRemove}
              onCopyToAll={() =>
                copyTo(
                  day,
                  DAY_ORDER.filter((d) => d !== day),
                )
              }
              onCopyToWeekdays={() => copyTo(day, WEEKDAYS)}
              onCopyToWeekend={() => copyTo(day, WEEKEND)}
            />
          ))}
        </ul>
      ) : null}

      {missingDays.length > 0 ? (
        <button
          type="button"
          onClick={openAddNewDay}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md border border-dashed border-neutral-300 px-4 text-sm font-medium text-neutral-600 hover:border-neutral-500"
        >
          <span aria-hidden="true">+</span> Añadir horario
        </button>
      ) : null}

      <WindowSheet
        sheet={sheet}
        onClose={closeSheet}
        onAdd={(w) => {
          onAdd(w)
          closeSheet()
        }}
        onUpdate={(idx, w) => {
          onUpdate(idx, w)
          closeSheet()
        }}
        onRemove={(idx) => {
          onRemove(idx)
          closeSheet()
        }}
      />
    </div>
  )
}

function groupByDay(
  fields: Array<RecurringWindow & { id: string }>,
): Map<DayOfWeek, IndexedWindow[]> {
  const map = new Map<DayOfWeek, IndexedWindow[]>()
  fields.forEach((field, index) => {
    const list = map.get(field.day) ?? []
    list.push({ ...field, index })
    map.set(field.day, list)
  })
  // Orden interno por hora de inicio para que los chips se lean cronológicamente.
  for (const [day, list] of map) {
    list.sort((a, b) => a.start.localeCompare(b.start))
    map.set(day, list)
  }
  return map
}
