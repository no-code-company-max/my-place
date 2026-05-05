# Home — Design Notes

> **Slice:** Home (la primera pantalla que ve el usuario al entrar a una comunidad)
> **Layout:** Bento grid de 2 columnas
> **Stack target:** Next.js 15 (App Router) + React 19 + TypeScript + Tailwind + Supabase + Prisma + TanStack Query

---

## Concepto

La Home es un **resumen de la comunidad**: lo último que pasó en cada sección, presentado como bloques visualmente distintos (bento). El usuario llega acá y entiende de un vistazo:

1. ¿Qué se está discutiendo? (último thread)
2. ¿Qué evento viene? (próximo evento)
3. ¿Qué hay en la biblioteca? (últimos recursos)
4. ¿Quiénes están? (miembros)

A diferencia de las otras pestañas (Discusiones, Eventos, Biblioteca) que son listas/feeds especializados, **Home es deliberadamente heterogénea** — cada bloque tiene un tratamiento visual distinto para crear ritmo y jerarquía.

## Estructura

```
┌─────────────────────────────────┐
│ [emoji] Nombre de comunidad     │  ← Hero header
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ CONVERSACION                │ │  ← Latest thread (full-width)
│ │ [avatar] Autor              │ │     spans 2 cols
│ │ Título del thread           │ │
│ │ Preview del contenido…      │ │
│ └─────────────────────────────┘ │
│ ┌─────────────┐ ┌─────────────┐ │
│ │ Próximo     │ │ BIBLIOTECA  │ │  ← Event card | Library card
│ │ evento      │ │ Últimos     │ │     (1col + 1col)
│ │ (variant)   │ │ recursos    │ │
│ └─────────────┘ └─────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ MIEMBROS [avatars]          │ │  ← Members (full-width)
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

- **Grid:** `grid-template-columns: 1fr 1fr; gap: 10px` (8px en density compact)
- **Padding outer:** `4px 12px 100px`
- **Padding inner cards:** `var(--pad)` (12/14/18px según density)
- **Border radius cards:** `var(--radius-card)` (14/16/20px)

## Bloques

### 1. Community Hero

Avatar 44×44 con emoji + nombre comunidad en serif grande (26px, weight 700).

### 2. Latest Thread Card (full-width)

- Overline: `CONVERSACION` (uppercase, letter-spacing 0.6, muted)
- Avatar autor 26px + nombre
- Título serif 17px, weight 600
- Preview: 2 líneas line-clamp, muted, 13px
- Click → abre detalle del thread

### 3. Next Event Card (1 col)

Tiene **4 variantes visuales** para elegir (ver tweak `eventVariant`):

- **`postit`** (default): cuadrado amarillo con tape, ligera rotación, día grande
- **`wall`**: calendario tipo página arrancada con grilla de días
- **`minimal`**: monospace, línea accent, técnico
- **`countdown`**: "Faltan X días" grande, fondo accent color

Click → abre detalle del evento.

### 4. Library Card (1 col)

Tiene **3 variantes** (tweak `libraryVariant`):

- **`stack`** (default): papeles fanned con doc featured arriba
- **`list`**: lista vertical de 3 docs
- **`tiles`**: grid 2×2 con kind chips por color

### 5. Members Card (full-width)

- Icono Users + label `MIEMBROS` a la izquierda
- Avatares apilados (5 max, overlap -10px) a la derecha
- No es clickeable, es solo display

## Datos requeridos

Por comunidad:

```typescript
type HomeData = {
  community: { id: string; name: string; emoji: string; members: number }
  latestThread: {
    id: string
    title: string
    preview: string
    author: string
    initials: string
    time: string
  }
  nextEvent: {
    id: string
    title: string
    date: string
    time: string
    place: string
    emoji: string
    attending: number
  }
  latestDocs: Array<{
    id: string
    title: string
    kind: 'PDF' | 'Nota' | 'Link' | 'Carpeta' | 'Figma' | 'Mapa' | 'Hoja'
  }>
  totalDocs: number
  members: Array<{ initials: string }>
}
```

## Patrones de interacción

- Tap en thread card → navegación a `/[community]/threads/[threadId]`
- Tap en event card → navegación a `/[community]/events/[eventId]`
- Tap en library card → navegación a `/[community]/library` (no a un doc específico, es un teaser)
- Members card es informativa, no clickeable

## Decisiones de diseño

1. **Por qué bento y no feed lineal**: Home no es para leer en profundidad, es para escanear. Bento permite que el ojo salte entre tipos de contenido sin parsing.
2. **Por qué solo 1 thread y 1 evento**: si el usuario quiere más, hay tabs dedicadas. Home no compite con esas tabs, las complementa.
3. **Por qué variantes de event/library**: en testing, el "tile minimal" funciona mejor para usuarios pragmáticos, "post-it" para comunidades casuales. Mantener configurable.
4. **Por qué members al final**: es contexto, no acción. No debería competir con contenido.
5. **No agregar "Welcome back" o saludos**: filler innecesario. El nombre de la comunidad ya orienta.

## Estados

- **Empty (comunidad nueva, sin threads/events/docs)**: cada card muestra un estado empty propio (ej: "Aún no hay discusiones · Empezar una"). NO ocultar la card.
- **Loading**: skeleton de cada bloque con la misma forma.
- **Error**: card individual muestra error inline, las otras siguen funcionando (independencia de slices).

## Tokens usados

Ver `design-tokens.css`. Variables clave:

- `--bg`, `--surface`, `--soft`, `--text`, `--muted`, `--border`, `--accent`, `--accent-soft`
- `--pad`, `--radius-card`
- `--title-font` (serif para títulos)

## Fuera de scope para esta slice

- Pull-to-refresh (próxima iteración)
- Animaciones de entrada (próxima iteración)
- Personalización del layout por usuario (próxima iteración)
- Push notifications badge (próxima iteración)
