# Landing — sistema visual

> Cómo se ve la landing. Regla raíz: **la landing usa los tokens del
> producto que ya existen en `src/app/globals.css`** (defaults warm de la
> rebrand F.G). NO inventa tokens propios, NO hardcodea colores Tailwind.
> Coherente con `docs/theming.md` y con el principio "menos es más,
> saturación es fracaso de diseño" (`blueprint.md`).

## Principio rector

La landing es la **puerta**, y "misma identidad visual de la puerta al
interior" es un principio no-negociable del blueprint (§ "Principios de
diseño no negociables", punto 3). Por eso la landing se ve como el
producto: **sobria, cálida, tipográfica, nada grita**. No es una landing
de SaaS con gradientes, glow, ni secciones saturadas.

Lo que la landing transmite visualmente: calma, espacio, confianza. Lo
que NO hace: animaciones de atención, contadores, badges UPPERCASE,
urgencia, "social proof" con números (sin métricas vanidosas).

## Color — solo CSS vars de `globals.css`

> Estos tokens YA existen en `:root` de `src/app/globals.css` (con
> fallbacks `@supports` para browsers sin `oklch()`/`color-mix()`). La
> landing los consume; no define ninguno nuevo.

| Token         | Default (warm)                 | Uso en la landing                                  |
| ------------- | ------------------------------ | -------------------------------------------------- |
| `--bg`        | `oklch(0.985 0.006 75)` cream  | Fondo de toda la página                            |
| `--surface`   | `oklch(1 0 0)` blanco          | Tarjetas opcionales de "cómo funciona"             |
| `--soft`      | `oklch(0.95 0.008 75)`         | Banda de fondo alterna entre secciones (sutil)     |
| `--text`      | `oklch(0.22 0.008 60)`         | Titulares y cuerpo principal                       |
| `--muted`     | `oklch(0.55 0.012 60)`         | Subtítulos, texto secundario, footer               |
| `--border`    | `oklch(0.9 0.008 75)`          | Hairline divisor entre secciones / sobre el footer |
| `--accent`    | `#b5633a` warm brown           | CTA, links, overline. **Único color "fuerte"**     |
| `--accent-soft` | `color-mix(accent 14%)`      | Fondo sutil del bloque CTA (opcional)              |

Reglas de color:

- **Un solo acento.** El `--accent` warm brown es el único color con
  peso. Nada de paletas múltiples ni secundarios. Saturación = fracaso.
- **Fondos:** la página es mayormente `--bg`. Para separar secciones se
  alterna `--bg` ↔ `--soft` (cambio casi imperceptible, no bloques de
  color). Nunca un fondo oscuro de impacto.
- **Cómo se aplica (regla de `theming.md`):** color SIEMPRE vía
  `style={{ ... 'var(--token)' }}`, nunca clases Tailwind de color
  (`bg-neutral-900`, etc.). El placeholder actual usa `bg-neutral-900` en
  el CTA — **eso se reemplaza** por `var(--accent)`.

```tsx
// Bien
<section style={{ background: 'var(--bg)', color: 'var(--text)' }}>
<a className="rounded-md px-5 py-2"
   style={{ background: 'var(--accent)', color: '#fff' }}>

// Mal (rompe theming.md)
<section className="bg-amber-50 text-stone-900">
```

> La landing usa los **defaults del producto** (no es theme-able por
> place: no pertenece a ningún place). No invoca `buildThemeVars()` con
> config — toma los valores de `:root`.

## Tipografía

Ya cargadas y self-hosted vía `next/font` en `src/app/layout.tsx`
(`Inter` + `Fraunces`, `display: 'swap'`, variables `--font-inter` /
`--font-fraunces`). La landing **reusa**; no agrega fuentes.

| Rol                | Fuente                          | Token                |
| ------------------ | ------------------------------- | -------------------- |
| Titulares (hero/h2)| **Fraunces**, a menudo *italic* | `var(--title-font)`  |
| Cuerpo / labels    | **Inter**                       | `var(--body-font)`   |

- El hero usa Fraunces (consistente con el `<h1 className="font-serif
  italic">Place</h1>` que ya existe). El italic es la firma tipográfica
  del producto — usarlo con criterio en el `<h1>`.
- `font-display: swap` ya está → texto visible inmediato con fuente de
  sistema mientras carga la webfont (cero bloqueo de render; protege FCP).
- Las clases `.font-serif` / `.font-title` de `globals.css` ya mapean a
  `var(--title-font)` — usarlas.

### Escala tipográfica (mobile-first, blueprint § 8 "Mobile-first")

Escala restringida, sin tamaños de impacto agresivos. Tailwind para el
tamaño (es layout, no color):

| Elemento            | Mobile        | Desktop (`md:`) | Peso / estilo            |
| ------------------- | ------------- | --------------- | ------------------------ |
| Hero `<h1>`         | `text-4xl`    | `text-6xl`      | Fraunces, italic, normal |
| Subtítulo hero      | `text-lg`     | `text-xl`       | Inter, `--muted`         |
| Section `<h2>`      | `text-2xl`    | `text-3xl`      | Fraunces                 |
| Overline (kicker)   | `text-xs`     | `text-sm`       | Inter, `--accent`, tracking suave, **NO uppercase agresiva** |
| Cuerpo              | `text-base`   | `text-base`     | Inter, `leading-relaxed` |
| Footer              | `text-sm`     | `text-sm`       | Inter, `--muted`         |

> Overline: `tracking-wide` y *capitalización normal* o small-caps
> discreto. **Prohibido** `uppercase` "que grita" (theming.md § "Lo que
> NO es configurable": sin badges UPPERCASE).

## Espaciado y layout (Tailwind — permitido para layout/spacing)

- **Contenedor:** `max-w-3xl mx-auto px-6` (lectura cómoda, no full-bleed
  de marketing). Aire generoso = calma.
- **Ritmo vertical entre secciones:** `py-20 md:py-28`. Espacio amplio,
  pocas secciones. "El aire es parte del mensaje."
- **Mobile-first**: diseñar a 1 columna; `md:` solo para reflow
  (ej. "cómo funciona" pasa de columna a fila de 3 en `md:`).
- **Sin scroll infinito, sin parallax, sin animaciones de entrada.**
  Carga estática, contenido quieto. Como mucho, transiciones CSS de hover
  en el CTA (`transition-colors`), nada más. Sin librerías de animación
  (framer-motion etc.) — viola el budget de JS y el principio "nada
  parpadea".

## Componentes de la landing

Todos Server Components en `src/app/_landing/` (ver `architecture.md`).
Sin estado, sin `'use client'`.

| Componente        | Archivo                 | Descripción                                                                 |
| ----------------- | ----------------------- | --------------------------------------------------------------------------- |
| Hero              | `_landing/hero.tsx`     | Overline + `<h1>` (Fraunces italic) + subtítulo + CTA primario.             |
| ValueProp         | `_landing/value-prop.tsx` | 2–3 afirmaciones de qué es Place (texto, sin íconos llamativos).           |
| HowItWorks        | `_landing/how-it-works.tsx` | 3 pasos (registrarte → crear/unirte → entrar). 1 col mobile, 3 en `md:`. |
| Cta               | `_landing/cta.tsx`      | Bloque de cierre con el CTA repetido (fondo `--accent-soft` opcional).       |
| Footer            | `_landing/footer.tsx`   | Wordmark "Place" + links mínimos (legales si D6) + hairline `--border`.      |

`src/app/page.tsx` compone estos en orden: Hero → ValueProp → HowItWorks
→ Cta → Footer. Sin nav header (no hay otras páginas públicas; una
landing de una pantalla no necesita navbar — menos es más).

### Botón / CTA (único elemento "fuerte")

```tsx
<Link
  href="/login"
  className="inline-block rounded-md px-6 py-3 text-base transition-colors"
  style={{ background: 'var(--accent)', color: '#fff' }}
>
  Entrar
</Link>
```

- Forma: `rounded-md`, padding cómodo. **Un solo CTA** (texto a definir,
  ver `content.md` + D4). Reaparece en el bloque `Cta` de cierre.
- `target` por defecto (misma pestaña). `/login` es ruta `AUTH_PATHS` del
  middleware (pasa sin gate) y vive en el apex; el href es **relativo**
  (no anteponer subdomain/slug — regla de memoria "URLs públicas son
  subdominio": el apex es el host, el path es `/login`).
- Hover: oscurecer levemente vía `transition-colors` (CSS puro). Sin
  glow, sin escala, sin pulso.

## Imágenes

- **Default: sin imágenes** (hero tipográfico). Es lo más rápido y lo más
  coherente con el tono ("nada grita"). Cero requests de imagen, LCP =
  texto del `<h1>`.
- **Si D2 define un hero visual:** `next/image` obligatorio, formato
  AVIF/WebP, `width`/`height` explícitos (CLS = 0), `priority` (es el
  LCP), `sizes` correcto. Presupuesto: ≤ 1 imagen, ver `README.md`.
- Wordmark "Place" = **texto** (Fraunces italic), no un SVG/PNG de logo,
  salvo que exista un mark oficial del producto **[A DEFINIR con owner]**.

## Resumen de no-negociables visuales

- Color: solo tokens `globals.css`, un único acento, vía `style`+CSS var.
- Tipografía: solo Inter + Fraunces del root layout, `swap`.
- Sin animación de atención, sin parallax, sin gradientes, sin glow.
- Sin métricas / números / "social proof" en pantalla.
- Mobile-first, mucho aire, pocas secciones, sin navbar, sin scroll
  infinito.
</content>
