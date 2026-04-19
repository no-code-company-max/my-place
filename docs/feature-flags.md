# Feature flags por place

Cada place tiene un array `enabledFeatures` en su config. El producto lee esto al renderizar y decide qué zonas, widgets y acciones están disponibles.

## Registro central

```typescript
// src/shared/config/features.config.ts
export const CORE_FEATURES = ['members'] as const
export const OPTIONAL_FEATURES = ['conversations', 'events', 'library'] as const

export type FeatureId = (typeof CORE_FEATURES)[number] | (typeof OPTIONAL_FEATURES)[number]

type FeatureManifest = {
  id: FeatureId
  required: boolean
  zone: { order: number; component: string } | null
  widget: string
}

export const FEATURE_REGISTRY: Record<FeatureId, FeatureManifest> = {
  members: {
    id: 'members',
    required: true,
    zone: null, // members no es zona propia, vive en presencia
    widget: 'MembersWidget',
  },
  conversations: {
    id: 'conversations',
    required: false,
    zone: { order: 1, component: 'ConversationsZone' },
    widget: 'ConversationWidget',
  },
  events: {
    id: 'events',
    required: false,
    zone: { order: 2, component: 'EventsZone' },
    widget: 'EventWidget',
  },
  library: {
    id: 'library',
    required: false,
    zone: { order: 3, component: 'LibraryZone' },
    widget: 'LibraryWidget',
  },
}
```

## Configuración por el admin

El admin enciende/apaga features desde `{slug}.place.app/settings/features`. Cambios requieren confirmación porque apagar una feature esconde su contenido, no lo borra.

## Qué significa apagar una feature

Cuando una feature está apagada en un place:

- Su zona desaparece del swipe horizontal
- Su widget desaparece de la portada
- No aparece en el compose button ("Traer al lugar")
- El contenido existente se preserva — queda oculto, no borrado
- Si se vuelve a encender, todo reaparece exactamente como estaba

## Features requeridas

`CORE_FEATURES` son las que no se pueden apagar:

- **members**: siempre activo. Un place sin miembros no es un place.

El resto son opcionales.

## Library no es parte del MVP

Está en el registro para dejar el slot reservado, pero el MVP solo implementa members, conversations y events. Intentar activar `library` en settings debe devolver "Próximamente" hasta que se implemente.

## Agregar una feature nueva

Para agregar una feature nueva:

1. Crear carpeta en `src/features/nueva-feature/`
2. Exportar la API pública en `public.ts`
3. Agregar entry en `FEATURE_REGISTRY` con su manifest
4. La feature aparece automáticamente como opción en settings del place
5. No se toca código de ninguna otra feature existente

Esto es lo que hace que el paradigma funcione: agregar features sin efectos colaterales.
