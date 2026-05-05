# Events — Design Notes

> **Slice:** Events (lista de eventos + detalle de un evento individual)
> **Layout:** Bento grid de 2 columnas (lista) · scroll vertical (detalle)
> **Stack target:** Next.js 15 (App Router) + React 19 + TypeScript + Tailwind + Supabase + Prisma + TanStack Query

---

## Concepto

Los eventos son **el mecanismo principal de coordinación** de una comunidad.
La slice tiene dos pantallas:

1. **Lista (bento)** — repaso visual rápido de qué se viene. El primer evento
   es hero (full-width), el resto son cards más chicas.
2. **Detalle** — todo lo que necesitás para decidir y participar: cuándo,
   dónde, quiénes van, qué se está hablando del evento.

Decisión clave: **el detalle de un evento es un thread con un event card
arriba**. No inventamos un layout nuevo — reusamos el de Threads y le
metemos un bloque distintivo en el header. Esto baja carga cognitiva y
código, y deja claro que un evento es "una conversación con un cuándo".

---

## Pantalla 1 — Lista de eventos

### Estructura

```
┌─────────────────────────────────┐
│ EVENTOS 📅                      │  ← SectionHead
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ 🎉                          │ │  ← Hero card (full-width)
│ │ SÁB 27 ABR · 10:00          │ │
│ │ Feria de vecinos            │ │
│ │ Plaza Centro · 12 van       │ │
│ └─────────────────────────────┘ │
│ ┌─────────────┐ ┌─────────────┐ │
│ │ 📋          │ │ 🔧          │ │  ← Cards 1col
│ │ MAR 30 ABR  │ │ SÁB 4 MAY   │ │
│ │ Asamblea    │ │ Arreglo de  │ │
│ │ mensual     │ │ veredas     │ │
│ └─────────────┘ └─────────────┘ │
└─────────────────────────────────┘
```

- **Outer padding:** `4px 12px 100px`
- **Grid:** `grid-template-columns: 1fr 1fr; gap: 10px`
- **Hero card** (`i === 0`): `gridColumn: 1 / -1`, padding 16, emoji 36px, title 20px
- **Other cards**: padding 14, emoji 26px, title 14px
- **Card border-radius:** 14
- **Card border:** `0.5px solid var(--border)`

### Cada card

- Emoji grande arriba (decorativo, viene del modelo del evento)
- Overline: `{date} · {time}` en uppercase, weight 700, color `--accent`,
  letter-spacing 0.6
- Título: serif/inter weight 700, letter-spacing -0.2
- Subtítulo: `{place}` (en hero también `· {attending} van`), color `--muted`

### Filtros (futuro, no en este slice)

Por ahora la lista muestra todos los eventos próximos en orden cronológico.
Filtros "Próximos / Pasados" se agregan cuando tengamos eventos pasados con
volumen.

---

## Pantalla 2 — Detalle de evento

### Estructura

```
┌─────────────────────────────────┐
│ [←]                             │  ← Back-only header (no title)
├─────────────────────────────────┤
│ 🎉 EVENTO                       │  ← Overline tag
│                                 │
│ Feria de vecinos                │  ← Title (serif 28px)
│                                 │
│ ┌─────────────────────────────┐ │
│ │ ┌──┐                        │ │  ← Event card
│ │ │27│ 10:00–14:00            │ │
│ │ │ABR│ 📍 Plaza Centro       │ │
│ │ │SÁB│ Organiza Lucía M.     │ │
│ │ └──┘                        │ │
│ │ ─────────────────────────── │ │
│ │ [👥👥👥👥] 12 van           │ │
│ │                             │ │
│ │ [Voy] [Tal vez] [No puedo]  │ │  ← RSVP triplet
│ └─────────────────────────────┘ │
│                                 │
│ Nos juntamos para compartir…    │  ← Description (body)
│                                 │
│ [LM] Organizado por Lucía M.    │  ← Author footer
│                                 │
│ ──────────────────────────────  │
│                                 │
│ [Comentarios — idénticos al     │
│  patrón de Threads]             │
│                                 │
├─────────────────────────────────┤
│ [Escribir respuesta...]    [→] │  ← Composer (sticky)
└─────────────────────────────────┘
```

- **Header:** solo back button (36×36, surface bg, border 0.5px), sin título
- **Content padding:** `20px 22px 12px`
- **Composer:** sticky bottom, `border-top: 0.5px solid var(--border)`,
  padding `10px 12px 16px`

### Bloque "Tag de evento"

Overline tipo `🎉 EVENTO` — fontSize 11, weight 700, letter-spacing 0.8,
uppercase, color `--accent`. Emoji al lado del label.

### Título

Serif (`var(--title-font)`), fontSize 28, weight 600, letter-spacing -0.7,
line-height 1.15. Igual al título de un thread — eso es deliberado, refuerza
que es la misma metáfora.

### Event card (el bloque distintivo)

Caja de `var(--surface)` con border 0.5px, radius 14, padding 14.

**Row 1 — Calendar tile + info:**

- **Tile** (56×60, radius 10, bg `--soft`, flex-col centered):
  - Mes en uppercase (10px, weight 700, color `--accent`, letter-spacing 0.6)
  - Día (serif 22px, weight 600, color `--text`)
  - DOW en uppercase (9px, weight 600, color `--muted`, letter-spacing 0.4)
- **Info** (flex 1):
  - Hora (14px, weight 600, color `--text`)
  - 📍 Lugar (13px, color `--muted`, single-line ellipsis)
  - "Organiza" + nombre (12px, color `--muted`, nombre `--text` weight 500)

**Row 2 — Attendees + count:**

- Separador top: `border-top: 0.5px solid var(--border)`, padding-top 12,
  margin-top 14
- Avatares (22px, ring 2px `--surface`, overlap -6px) + "{n} van"

**Row 3 — RSVP triplet:**

- Grid 3 columns equal, gap 6, margin-top 12
- Cada botón: height 40, radius 10
- **Inactivo:** bg `--soft`, color `--text`
- **Activo:** bg `--text`, color `--bg`
  - Si activo + id "going": prepend Check icon (12px)
- **Toggle:** apretar el activo lo deselecciona (`rsvp` → null)
- Estados son exclusivos: solo uno activo a la vez

### Descripción

Body serif (`var(--title-font)`), fontSize 17, line-height 1.55,
letter-spacing -0.1, color `--text`, margin-top 18.

### Author footer

Avatar 20px + "Organizado por **{nombre}**" (12px, color `--muted`,
nombre `--text` weight 500). Margin-top 22.

### Comentarios

**Idénticos al detalle de Threads.** Ver `docs/design/threads/` cuando exista
ese package, o usar `components/ui/CommentList.tsx` si ya está extraído.

Borde superior 0.5px, padding-top 12, margin-top 16.

Cada comentario:

- Avatar 28px + nombre weight 600 + "· hace 2 h"
- Quote opcional (si `quoteOf` apunta a otro comment): caja con borde-left
  2px accent, bg `--soft`, radius 0/6/6/0, mostrando autor del quote y body
  truncado a 2 líneas
- Body 14px line-height 1.5
- Botón "Responder" → mete ese comment en el composer como quote

### Composer

**Idéntico al de Threads.**

- Si hay un comment quoted: mostrar quote chip arriba con × para cancelar
- Input radius 20, height 40, bg `--surface`, border 0.5px
- Botón send circular 40×40, bg `--accent` cuando hay texto, `--soft` cuando vacío

---

## Datos requeridos

```typescript
type EventData = {
  id: string
  communityId: string
  title: string
  emoji: string // decorativo, default '📅'
  description: string // body, plain text con saltos de línea
  date: string // ISO timestamp
  endDate?: string // opcional para eventos multi-hora
  place: string
  host: {
    id: string
    name: string
    initials: string
  }
  attendees: Array<{
    userId: string
    initials: string
    rsvp: 'going' | 'maybe' | 'no'
  }>
  myRsvp: 'going' | 'maybe' | 'no' | null // del usuario actual
  comments: Array<Comment> // mismo shape que Thread.comments
}

type EventListItem = Pick<EventData, 'id' | 'title' | 'emoji' | 'date' | 'place'> & {
  time: string // formateado "10:00–14:00"
  attending: number // count de attendees con rsvp='going'
}
```

### Helpers de formato

```typescript
// "Sáb 27 Abr" para listas
formatEventDateShort(date: Date): string

// { dow: 'SAB', day: '27', month: 'ABR' } para el calendar tile
parseEventDateParts(date: Date): { dow: string; day: string; month: string }

// "10:00–14:00" o "10:00"
formatEventTime(start: Date, end?: Date): string
```

---

## Patrones de interacción

- Tap en card de lista → `/[community]/events/[id]`
- Back en detalle → vuelve a lista (preserva scroll position)
- Tap RSVP → mutación optimista con Server Action
- Tap "Responder" en comment → mete el comment en composer como quote
- Tap × en quote chip → cancela el quote, mantiene el texto

## Decisiones de diseño

1. **Detalle de evento = thread con event card arriba.** Misma metáfora,
   misma navegación, mismo composer. Reuso máximo, consistencia visual.
2. **Hero card en lista.** El primer evento (más próximo) es el más
   relevante — merece full-width. Los siguientes son cards comparables.
3. **RSVP triplet siempre visible.** No esconder en menú: la acción más
   importante del detalle debe ser inmediata.
4. **No hay un calendario mensual.** Decidimos que comunidades pequeñas no
   necesitan vista calendario; una lista cronológica funciona y es más
   liviana. Si una comunidad pide calendario, lo agregamos como variante.
5. **Comentarios primera-clase.** Los eventos generan logística; las
   preguntas viven en comentarios, no en chat aparte. Reusa Threads.
6. **Author footer abajo de la descripción**, no en el header. El header
   queda limpio (back-only) para que el título respire.

## Estados

- **Empty (comunidad sin eventos)**: mostrar mensaje vacío + CTA "Crear
  primer evento" (placeholder en este slice — el form es out of scope).
- **Loading lista**: skeleton de 3 cards (1 hero + 2 chicas).
- **Loading detalle**: skeleton del header (tag + título), event card
  skeleton, lista de comments skeleton.
- **Error**: error.tsx por slice — fallback con retry button.
- **404 evento**: `notFound()` en Server Component.
- **Evento pasado**: `myRsvp` es read-only, RSVP triplet se muestra
  pero no es interactivo (visual: opacity 0.6, pointer-events none).
  Composer también deshabilitado.

## Tokens usados

Ver `design-tokens.css`. Variables clave:

- `--bg`, `--surface`, `--soft`, `--text`, `--muted`, `--border`, `--accent`
- `--pad`, `--radius-card`
- `--title-font` (serif para títulos y body de descripción)

## Fuera de scope para esta slice

- Crear/editar evento (form) — próxima iteración
- Calendario mensual / vista grid — a evaluar
- Recordatorios push antes del evento — próxima iteración
- Export `.ics` para añadir al calendario del teléfono — próxima iteración
- Co-organizadores múltiples — próxima iteración
- Variantes de event card (wall/minimal/countdown) — defaults a `postit`,
  exponer via preferencia de comunidad después
