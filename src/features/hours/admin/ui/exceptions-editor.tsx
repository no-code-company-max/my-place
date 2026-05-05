'use client'

import { useState } from 'react'
import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetClose,
  BottomSheetContent,
  BottomSheetDescription,
  BottomSheetFooter,
  BottomSheetHeader,
  BottomSheetTitle,
} from '@/shared/ui/bottom-sheet'
import type { DateException } from '@/features/hours/domain/types'
import { formatTime } from '@/features/hours/ui/format-time'

/**
 * Editor de excepciones por fecha. Dos tipos:
 * - `closed: true` → cerrado aunque el día caiga en una ventana recurrente
 *   (feriado, día de duelo, feria cerrada).
 * - `windows: [...]` → apertura extraordinaria en un día que normalmente estaría
 *   cerrado (ej. un sábado puntual).
 *
 * La `date` se interpreta en el timezone del place (no UTC).
 *
 * UX: lista de filas tappables + botón "Agregar excepción" full-width que
 * abre un `<BottomSheet>`. La edición ocurre en el mismo sheet (tap fila).
 *
 * **API pública**: `fields`, `onAdd`, `onUpdate`, `onRemove`. El parent
 * (`<HoursForm>`) es el ÚNICO que invoca `useFieldArray({ name: 'exceptions' })`
 * — esa es la fuente canónica del array. Tener dos instancias del mismo
 * `name` causa desyncs (RHF docs: "only one is effective"), que se
 * manifiestan como filas que no actualizan tras editar.
 */

type Props = {
  fields: Array<DateException & { id: string }>
  onAdd: (e: DateException) => void
  onUpdate: (idx: number, e: DateException) => void
  onRemove: (idx: number) => void
}

type SheetState =
  | { mode: 'closed' }
  | { mode: 'add' }
  | { mode: 'edit'; index: number; initial: DateException }

export function ExceptionsEditor({ fields, onAdd, onUpdate, onRemove }: Props) {
  const [sheet, setSheet] = useState<SheetState>({ mode: 'closed' })

  function openAdd() {
    setSheet({ mode: 'add' })
  }

  function openEdit(idx: number, initial: DateException) {
    setSheet({ mode: 'edit', index: idx, initial })
  }

  function closeSheet() {
    setSheet({ mode: 'closed' })
  }

  return (
    <section className="space-y-3" aria-labelledby="hours-exceptions-heading">
      <h2
        id="hours-exceptions-heading"
        className="border-b pb-2 font-serif text-xl"
        style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
      >
        Excepciones
      </h2>
      <p className="text-xs" style={{ color: 'var(--muted)' }}>
        Feriados o aperturas extraordinarias. La fecha se interpreta en el timezone del place. Una
        excepción sobreescribe completamente las ventanas recurrentes de ese día.
      </p>

      {fields.length === 0 ? (
        <p className="text-sm italic text-neutral-500">Sin excepciones.</p>
      ) : (
        <ul className="divide-y divide-neutral-200 border-y border-neutral-200">
          {fields.map((field, idx) => (
            <li key={field.id} className="min-h-[56px]">
              <button
                type="button"
                onClick={() => openEdit(idx, stripId(field))}
                className="flex w-full items-center gap-3 py-3 text-left hover:bg-neutral-50"
                aria-label={`Editar excepción del ${formatDateLong(field.date)}`}
              >
                <span className="font-mono text-sm text-neutral-700">{field.date}</span>
                <span className="flex-1 text-sm">
                  {'closed' in field ? (
                    <span className="inline-flex items-center rounded-full border border-neutral-300 px-2.5 py-1 text-xs">
                      Cerrado
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center rounded-full border border-neutral-300 px-2.5 py-1 text-xs tabular-nums"
                      suppressHydrationWarning
                    >
                      Horario especial:{' '}
                      {field.windows
                        .map((w) => `${formatTime(w.start)}–${formatTime(w.end)}`)
                        .join(', ')}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={openAdd}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-dashed border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:border-neutral-500"
      >
        + Agregar excepción
      </button>

      <ExceptionSheet
        sheet={sheet}
        onClose={closeSheet}
        onAdd={(e) => {
          onAdd(e)
          closeSheet()
        }}
        onUpdate={(idx, e) => {
          onUpdate(idx, e)
          closeSheet()
        }}
        onRemove={(idx) => {
          onRemove(idx)
          closeSheet()
        }}
      />
    </section>
  )
}

function stripId(field: DateException & { id: string }): DateException {
  if ('closed' in field) {
    return { date: field.date, closed: true }
  }
  return { date: field.date, windows: field.windows.map((w) => ({ start: w.start, end: w.end })) }
}

function formatDateLong(date: string): string {
  // `date` viene como YYYY-MM-DD; lo formateamos sin construir un Date
  // (evita corrimientos por timezone del viewer).
  const [y, m, d] = date.split('-')
  if (!y || !m || !d) return date
  const months = [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ]
  const monthIdx = Number(m) - 1
  const monthName = months[monthIdx] ?? m
  return `${Number(d)} de ${monthName} ${y}`
}

function ExceptionSheet({
  sheet,
  onClose,
  onAdd,
  onUpdate,
  onRemove,
}: {
  sheet: SheetState
  onClose: () => void
  onAdd: (e: DateException) => void
  onUpdate: (idx: number, e: DateException) => void
  onRemove: (idx: number) => void
}) {
  const open = sheet.mode !== 'closed'
  return (
    <BottomSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      {open ? (
        <ExceptionSheetForm sheet={sheet} onAdd={onAdd} onUpdate={onUpdate} onRemove={onRemove} />
      ) : null}
    </BottomSheet>
  )
}

type Kind = 'closed' | 'open'

function ExceptionSheetForm({
  sheet,
  onAdd,
  onUpdate,
  onRemove,
}: {
  sheet: Exclude<SheetState, { mode: 'closed' }>
  onAdd: (e: DateException) => void
  onUpdate: (idx: number, e: DateException) => void
  onRemove: (idx: number) => void
}) {
  const initial = sheet.mode === 'edit' ? sheet.initial : null
  const [date, setDate] = useState(initial?.date ?? '')
  const [kind, setKind] = useState<Kind>(
    initial && 'closed' in initial ? 'closed' : initial ? 'open' : 'closed',
  )
  const [start, setStart] = useState(
    initial && 'windows' in initial ? (initial.windows[0]?.start ?? '10:00') : '10:00',
  )
  const [end, setEnd] = useState(
    initial && 'windows' in initial ? (initial.windows[0]?.end ?? '17:00') : '17:00',
  )
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  function build(): DateException | null {
    if (!date) {
      setError('Elegí una fecha.')
      return null
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError('Fecha inválida.')
      return null
    }
    if (kind === 'closed') {
      setError(null)
      return { date, closed: true }
    }
    if (!start || !end) {
      setError('Ingresá hora de inicio y fin.')
      return null
    }
    if (start >= end) {
      setError('La hora de fin debe ser posterior a la de inicio.')
      return null
    }
    setError(null)
    return { date, windows: [{ start, end }] }
  }

  function handleSubmit() {
    const built = build()
    if (!built) return
    if (sheet.mode === 'edit') {
      onUpdate(sheet.index, built)
    } else {
      onAdd(built)
    }
  }

  const title =
    sheet.mode === 'edit'
      ? `Editar excepción del ${formatDateShort(sheet.initial.date)}`
      : 'Agregar excepción'

  return (
    <BottomSheetContent aria-describedby={undefined}>
      <BottomSheetHeader>
        <BottomSheetTitle>{title}</BottomSheetTitle>
        <BottomSheetDescription>
          Una excepción sobreescribe el horario recurrente de esa fecha.
        </BottomSheetDescription>
      </BottomSheetHeader>
      <BottomSheetBody>
        <div className="space-y-4 py-2">
          <label className="block">
            <span className="mb-1 block text-sm text-neutral-600">Fecha</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="block min-h-[44px] w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-base focus:border-neutral-500 focus:outline-none"
            />
          </label>

          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm text-neutral-600">Tipo de excepción</legend>
            <label className="flex min-h-11 items-center gap-2 text-base">
              <input
                type="radio"
                name="exception-kind"
                checked={kind === 'closed'}
                onChange={() => setKind('closed')}
                className="h-4 w-4"
              />
              Cerrado
            </label>
            <label className="flex min-h-11 items-center gap-2 text-base">
              <input
                type="radio"
                name="exception-kind"
                checked={kind === 'open'}
                onChange={() => setKind('open')}
                className="h-4 w-4"
              />
              Horario especial
            </label>
          </fieldset>

          {kind === 'open' ? (
            <div className="space-y-3">
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
            </div>
          ) : null}

          {error ? (
            <p role="alert" className="text-sm text-amber-700">
              {error}
            </p>
          ) : null}
        </div>
      </BottomSheetBody>
      <BottomSheetFooter>
        <button
          type="button"
          onClick={handleSubmit}
          className="inline-flex min-h-12 w-full items-center justify-center rounded-md bg-neutral-900 px-4 text-sm font-medium text-white"
        >
          Guardar
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
          <BottomSheetClose asChild>
            <button
              type="button"
              className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-neutral-300 px-4 text-sm"
            >
              Cancelar
            </button>
          </BottomSheetClose>
        )}
      </BottomSheetFooter>
    </BottomSheetContent>
  )
}

function formatDateShort(date: string): string {
  const [y, m, d] = date.split('-')
  if (!y || !m || !d) return date
  return `${d}/${m}/${y}`
}
