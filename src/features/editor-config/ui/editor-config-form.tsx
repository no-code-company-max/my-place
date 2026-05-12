'use client'

import * as React from 'react'
import { useState, useTransition } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from '@/shared/ui/toaster'
import { editorPluginsConfigSchema } from '../domain/schemas'
import type { EditorPluginsConfig } from '../domain/types'
import { updateEditorConfigAction } from '../server/actions'

/**
 * Form orchestrator de `/settings/editor`. Toggles per-plugin renderizados
 * como **Card-per-item con switch on/off** (patrón canónico de
 * `docs/ux-patterns.md` § "Card-per-item con header + body + switch on/off").
 *
 * **Save model — todo manual (post 2026-05-12):**
 *
 * Cualquier toggle aplica solo localmente; `formState.isDirty` se enciende
 * vía RHF. El user persiste todos los cambios pendientes con UN tap en el
 * botón "Guardar cambios" page-level. NO hay autosave por toggle.
 *
 * Iter previa usaba autosave + soft barrier (toggle limpio = persist
 * inmediato; toggle con dirty = defer). Era confuso: el mismo gesto tenía
 * dos comportamientos. Migrado a "todo manual" por decisión user
 * 2026-05-12 (alinear con hours, access, system).
 *
 * **Single commit path:** `persist(snapshot)` invocado solo por `onSubmit`.
 * `methods.reset(snapshot)` post-success re-baselinea defaultValues — sin
 * esto, el botón Save queda "Cambios sin guardar" para siempre.
 */

type PluginEntry = {
  key: keyof EditorPluginsConfig
  label: string
  description: string
}

const PLUGIN_LABELS: ReadonlyArray<PluginEntry> = [
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
  const { handleSubmit, setValue, control, formState, reset } = methods
  const { isDirty } = formState

  // `useWatch` para re-render reactivo cuando los toggles cambian — el
  // switch on/off depende del valor actual, no del defaultValue.
  const values = useWatch({ control, defaultValue: initial }) as EditorPluginsConfig

  /**
   * Persiste el snapshot completo. Único caller: `onSubmit` (botón
   * "Guardar cambios" page-level). NO hay autosave bajo el modelo "todo
   * manual".
   */
  function persist(snapshot: EditorPluginsConfig): void {
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
          toast.success('Configuración guardada.')
        } else {
          toast.error(mapErrorCode(result.error))
        }
      } catch (err) {
        toast.error(friendlyMessage(err))
      }
    })
  }

  function onSubmit(snapshot: EditorPluginsConfig): void {
    persist(snapshot)
  }

  function handleToggle(key: keyof EditorPluginsConfig, next: boolean): void {
    // Sólo muta RHF — sin autosave. RHF marca dirty automáticamente; el
    // botón "Guardar cambios" se habilita.
    setValue(key, next, { shouldDirty: true })
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

      <div className="space-y-3">
        {PLUGIN_LABELS.map((plugin) => (
          <PluginCard
            key={plugin.key}
            plugin={plugin}
            isOn={values[plugin.key] ?? true}
            disabled={pending}
            onToggle={(next) => handleToggle(plugin.key, next)}
          />
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <span
          aria-live="polite"
          className={isDirty && !pending ? 'text-xs text-neutral-500' : 'text-xs text-transparent'}
        >
          {isDirty && !pending ? '• Cambios sin guardar' : ' '}
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

/**
 * Card individual de plugin con header (label + descripción + switch).
 * Sin body (los plugins no tienen sub-data) — el card se reduce al header.
 *
 * Patrón canónico de `docs/ux-patterns.md` § "Card-per-item": container
 * rounded border-neutral-200, header h-[56px] mínimo, switch role="switch"
 * accesible. Idéntico al `<DaySwitch>` de hours/week-editor-day-card.
 */
function PluginCard({
  plugin,
  isOn,
  disabled,
  onToggle,
}: {
  plugin: PluginEntry
  isOn: boolean
  disabled: boolean
  onToggle: (next: boolean) => void
}): React.JSX.Element {
  return (
    <div className="rounded-md border border-neutral-200">
      <div className="flex min-h-[56px] items-center gap-3 px-3 py-3">
        <div className="min-w-0 flex-1">
          <div className="text-base font-medium text-neutral-900">{plugin.label}</div>
          <div className="text-xs text-neutral-500">{plugin.description}</div>
        </div>
        <PluginSwitch isOn={isOn} label={plugin.label} disabled={disabled} onToggle={onToggle} />
      </div>
    </div>
  )
}

/**
 * Switch accesible sin dep nueva. `role="switch"` + `aria-checked` cumplen
 * WAI-ARIA. Touch target 44px (el contenedor padre tiene min-h-[56px]).
 *
 * Implementación idéntica al `<DaySwitch>` de
 * `src/features/hours/admin/ui/week-editor-day-card.tsx` para coherencia
 * visual cross-feature.
 */
function PluginSwitch({
  isOn,
  label,
  disabled,
  onToggle,
}: {
  isOn: boolean
  label: string
  disabled: boolean
  onToggle: (next: boolean) => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isOn}
      aria-label={`${label}: ${isOn ? 'activado, tocá para desactivar' : 'desactivado, tocá para activar'}`}
      disabled={disabled}
      onClick={() => onToggle(!isOn)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:cursor-not-allowed disabled:opacity-60 ${
        isOn ? 'bg-neutral-900' : 'bg-neutral-300'
      }`}
    >
      <span
        aria-hidden="true"
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          isOn ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
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
