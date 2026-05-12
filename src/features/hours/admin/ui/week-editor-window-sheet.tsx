'use client'

import { useState } from 'react'
import {
  EditPanel,
  EditPanelBody,
  EditPanelClose,
  EditPanelContent,
  EditPanelDescription,
  EditPanelFooter,
  EditPanelHeader,
  EditPanelTitle,
} from '@/shared/ui/edit-panel'
import type { DayOfWeek, RecurringWindow } from '@/features/hours/domain/types'
import { DAY_ES } from './week-editor'

/**
 * BottomSheet para alta / edición / alta-de-día-nuevo de una ventana recurrente.
 *
 * Tres modos de uso (discriminados por `sheet.mode`):
 *  - `add`: agregar ventana a un día específico (botón "+" en el menú overflow del día).
 *  - `edit`: editar ventana existente — habilita botón "Eliminar" con confirmación inline.
 *  - `add-new-day`: alta inicial de un día sin ventanas — incluye day-picker (radios).
 *
 * Las ventanas NO cruzan medianoche (validación en `validate()` + Zod schema en
 * `domain/types.ts`); la UI guía con copy explícito y rechaza `start >= end`.
 */

export type SheetState =
  | { mode: 'closed' }
  | { mode: 'add'; day: DayOfWeek }
  | { mode: 'edit'; day: DayOfWeek; index: number; start: string; end: string }
  | { mode: 'add-new-day'; availableDays: ReadonlyArray<DayOfWeek> }

type Props = {
  sheet: SheetState
  onClose: () => void
  onAdd: (w: RecurringWindow) => void
  onUpdate: (idx: number, w: RecurringWindow) => void
  onRemove: (idx: number) => void
}

export function WindowSheet({ sheet, onClose, onAdd, onUpdate, onRemove }: Props) {
  const open = sheet.mode !== 'closed'

  return (
    <EditPanel
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      {open ? (
        <WindowSheetForm sheet={sheet} onAdd={onAdd} onUpdate={onUpdate} onRemove={onRemove} />
      ) : null}
    </EditPanel>
  )
}

function WindowSheetForm({
  sheet,
  onAdd,
  onUpdate,
  onRemove,
}: {
  sheet: Exclude<SheetState, { mode: 'closed' }>
  onAdd: (w: RecurringWindow) => void
  onUpdate: (idx: number, w: RecurringWindow) => void
  onRemove: (idx: number) => void
}) {
  const initialStart = sheet.mode === 'edit' ? sheet.start : '19:00'
  const initialEnd = sheet.mode === 'edit' ? sheet.end : '23:00'
  const [start, setStart] = useState(initialStart)
  const [end, setEnd] = useState(initialEnd)
  const [day, setDay] = useState<DayOfWeek | null>(
    sheet.mode === 'add-new-day' ? (sheet.availableDays[0] ?? null) : null,
  )
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  function resolveDay(): DayOfWeek | null {
    if (sheet.mode === 'add-new-day') return day
    return sheet.day
  }

  function validate(): RecurringWindow | null {
    const resolvedDay = resolveDay()
    if (!resolvedDay) {
      setError('Elegí un día.')
      return null
    }
    if (!start || !end) {
      setError('Ingresá hora de inicio y fin.')
      return null
    }
    if (start >= end) {
      setError('La hora de fin debe ser posterior a la de inicio (no cruza medianoche).')
      return null
    }
    setError(null)
    return { day: resolvedDay, start, end }
  }

  function handleSubmit() {
    const w = validate()
    if (!w) return
    if (sheet.mode === 'edit') {
      onUpdate(sheet.index, w)
    } else {
      onAdd(w)
    }
  }

  const title =
    sheet.mode === 'edit'
      ? `Editar ventana — ${DAY_ES[sheet.day]}`
      : sheet.mode === 'add'
        ? `Agregar ventana — ${DAY_ES[sheet.day]}`
        : 'Añadir horario'

  return (
    <EditPanelContent aria-describedby={undefined}>
      <EditPanelHeader>
        <EditPanelTitle>{title}</EditPanelTitle>
        <EditPanelDescription>
          La ventana debe ser del mismo día (sin cruzar medianoche).
        </EditPanelDescription>
      </EditPanelHeader>
      <EditPanelBody>
        <div className="space-y-4 py-2">
          {sheet.mode === 'add-new-day' ? (
            <fieldset className="space-y-2">
              <legend className="mb-1 block text-sm text-neutral-600">Día</legend>
              {sheet.availableDays.map((d) => (
                <label
                  key={d}
                  className="flex min-h-11 items-center gap-3 rounded-md border border-neutral-200 px-3 py-2 hover:border-neutral-400"
                >
                  <input
                    type="radio"
                    name="day-picker"
                    value={d}
                    checked={day === d}
                    onChange={() => setDay(d)}
                  />
                  <span className="text-base">{DAY_ES[d]}</span>
                </label>
              ))}
            </fieldset>
          ) : null}
          <label className="block">
            <span className="mb-1 block text-sm text-neutral-600">Desde</span>
            <input
              type="time"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="block min-h-[44px] w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-base tabular-nums focus:border-neutral-500 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-neutral-600">Hasta</span>
            <input
              type="time"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="block min-h-[44px] w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-base tabular-nums focus:border-neutral-500 focus:outline-none"
            />
          </label>
          {error ? (
            <p role="alert" className="text-sm text-amber-700">
              {error}
            </p>
          ) : null}
        </div>
      </EditPanelBody>
      <EditPanelFooter>
        <button
          type="button"
          onClick={handleSubmit}
          className="inline-flex min-h-12 w-full items-center justify-center rounded-md bg-neutral-900 px-4 text-sm font-medium text-white"
        >
          Listo
        </button>
        {sheet.mode === 'edit' ? (
          confirmDelete ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-md border border-neutral-300 px-4 text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => onRemove(sheet.index)}
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-md border border-red-600 bg-red-600 px-4 text-sm font-medium text-white"
              >
                Sí, eliminar
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-md px-4 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Eliminar
            </button>
          )
        ) : (
          <EditPanelClose asChild>
            <button
              type="button"
              className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-neutral-300 px-4 text-sm"
            >
              Cancelar
            </button>
          </EditPanelClose>
        )}
      </EditPanelFooter>
    </EditPanelContent>
  )
}
