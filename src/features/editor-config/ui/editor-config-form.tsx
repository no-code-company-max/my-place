'use client'

import * as React from 'react'
import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from '@/shared/ui/toaster'
import { editorPluginsConfigSchema } from '../domain/schemas'
import type { EditorPluginsConfig } from '../domain/types'
import { updateEditorConfigAction } from '../server/actions'

/**
 * Form orchestrator de `/settings/editor`. Toggles per-plugin con
 * autosave + soft barrier:
 *
 * - Si el form está limpio (`!isDirty`), un toggle dispara persist
 *   inmediato + `toast.success`.
 * - Si ya hay otros pendings, el toggle aplica local + `toast.info(DEFER_HINT)`
 *   y espera el explicit Save.
 *
 * Patrón canónico de `docs/ux-patterns.md` § "Autosave with soft barrier"
 * + § "`persist()` helper as the single commit path".
 *
 * Form state es la única source of truth (RHF). `methods.reset(snapshot)`
 * post-success re-baselinea defaultValues — sin esto, el botón Save queda
 * "Cambios sin guardar" para siempre.
 */

const PLUGIN_LABELS: ReadonlyArray<{
  key: keyof EditorPluginsConfig
  label: string
  description: string
}> = [
  {
    key: 'youtube',
    label: 'YouTube',
    description: 'Videos individuales (no playlists ni shorts).',
  },
  {
    key: 'spotify',
    label: 'Spotify',
    description: 'Tracks, episodios, shows, playlists y álbumes.',
  },
  {
    key: 'applePodcasts',
    label: 'Apple Podcasts',
    description: 'Show o episodio individual.',
  },
  {
    key: 'ivoox',
    label: 'iVoox',
    description: 'Episodio individual.',
  },
]

const DEFER_HINT =
  'Cambio aplicado localmente. Tocá «Guardar cambios» para confirmar todos los pendientes.'

export type EditorConfigFormProps = {
  placeId: string
  initial: EditorPluginsConfig
}

export function EditorConfigForm({ placeId, initial }: EditorConfigFormProps): React.JSX.Element {
  const [pending, startTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(null)

  const methods = useForm<EditorPluginsConfig>({
    defaultValues: initial,
    mode: 'onSubmit',
  })
  const { register, handleSubmit, getValues, setValue, formState, reset } = methods
  const { isDirty } = formState

  // Helper único de persist. Valida + dispara action + reset(snapshot)
  // post-success. Usado por explicit Save y autosave.
  function persist(snapshot: EditorPluginsConfig, opts: { successMessage?: string } = {}) {
    setFormError(null)
    const parsed = editorPluginsConfigSchema.safeParse(snapshot)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      setFormError(first?.message ?? 'Configuración inválida.')
      return
    }
    startTransition(async () => {
      try {
        const result = await updateEditorConfigAction({ placeId, config: parsed.data })
        if (result.ok) {
          reset(parsed.data)
          toast.success(opts.successMessage ?? 'Configuración guardada.')
        } else {
          toast.error(mapErrorCode(result.error))
        }
      } catch (err) {
        toast.error(friendlyMessage(err))
      }
    })
  }

  function onSubmit(values: EditorPluginsConfig) {
    persist(values)
  }

  function handleToggle(key: keyof EditorPluginsConfig, checked: boolean) {
    const wasDirty = isDirty
    setValue(key, checked, { shouldDirty: true })
    const next = { ...getValues(), [key]: checked }
    if (wasDirty) {
      // Soft barrier: hay otros pendings — diferimos hasta el explicit Save.
      toast.info(DEFER_HINT)
      return
    }
    persist(next, {
      successMessage: checked ? `${labelFor(key)} activado.` : `${labelFor(key)} desactivado.`,
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      {formError ? (
        <div
          role="alert"
          className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
        >
          {formError}
        </div>
      ) : null}

      <ul className="divide-y divide-neutral-200 border-y border-neutral-200">
        {PLUGIN_LABELS.map(({ key, label, description }) => {
          const inputId = `editor-config-${key}`
          return (
            <li key={key} className="flex min-h-[56px] items-center justify-between gap-4 py-2">
              <div className="min-w-0">
                <label htmlFor={inputId} className="block text-sm font-medium text-neutral-900">
                  {label}
                </label>
                <p className="text-xs text-neutral-500">{description}</p>
              </div>
              <input
                id={inputId}
                type="checkbox"
                {...register(key)}
                onChange={(e) => handleToggle(key, e.target.checked)}
                disabled={pending}
                className="h-5 w-5 cursor-pointer accent-neutral-900 disabled:cursor-not-allowed disabled:opacity-60"
                aria-describedby={`${inputId}-desc`}
              />
            </li>
          )
        })}
      </ul>

      <div className="flex items-center justify-between gap-3">
        <span
          aria-live="polite"
          className={isDirty && !pending ? 'text-xs text-neutral-500' : 'text-xs text-transparent'}
        >
          {isDirty && !pending ? '• Cambios sin guardar' : ' '}
        </span>
        <button
          type="submit"
          disabled={pending || !isDirty}
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-neutral-900 px-4 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  )
}

function labelFor(key: keyof EditorPluginsConfig): string {
  return PLUGIN_LABELS.find((p) => p.key === key)?.label ?? key
}

function mapErrorCode(code: 'forbidden' | 'invalid' | 'not_found'): string {
  switch (code) {
    case 'forbidden':
      return 'No tenés permisos para editar la configuración del editor.'
    case 'not_found':
      return 'No encontramos este place.'
    case 'invalid':
      return 'Configuración inválida.'
  }
}

/**
 * Mensaje amigable para errores opacos. El más común es "Failed to find
 * Server Action" cuando el deploy hashea un nuevo ID y la tab vieja sigue
 * abierta. Patrón heredado de `hours-form.tsx`.
 */
function friendlyMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : ''
  if (/Failed to find Server Action|Server Action.*not found/.test(message)) {
    return 'Esta página está desactualizada. Refrescá para guardar.'
  }
  if (message) return message
  return 'Error inesperado. Intentá de nuevo.'
}
