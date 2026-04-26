# Theming y customización visual por place

Cada place tiene su propia identidad visual, configurable por el admin. El producto provee defaults; cada place los personaliza dentro de límites que protegen usabilidad y coherencia.

## Design tokens (rebrand F.G — 2026-04-27)

El producto entró a una nueva paleta visual canónica (handoff design en
`handoff/events/`). El sistema de tokens se extendió manteniendo los
`--place-*` legacy como aliases backward-compat. Ver
`docs/decisions/2026-04-27-design-handoff-rebrand.md`.

### Tokens primarios (handoff)

Cada token es una CSS custom property generable por place via
`buildThemeVars(place.themeConfig)`. Defaults son la paleta warm:

| Token           | Default                                  | Rol                                     |
| --------------- | ---------------------------------------- | --------------------------------------- |
| `--bg`          | `oklch(0.985 0.006 75)` (cream)          | Fondo del place                         |
| `--surface`     | `oklch(1 0 0)` (puro)                    | Cards, contenedores                     |
| `--soft`        | `oklch(0.95 0.008 75)` (cream tenue)     | Tiles, fondos suaves, botones inactivos |
| `--text`        | `oklch(0.22 0.008 60)` (near-black warm) | Texto principal                         |
| `--muted`       | `oklch(0.55 0.012 60)`                   | Subtextos, metadata                     |
| `--border`      | `oklch(0.9 0.008 75)`                    | Hairlines, divisores                    |
| `--dot`         | `oklch(0.82 0.008 75)`                   | Separadores discretos, dots             |
| `--accent`      | `#b5633a` (warm brown)                   | Brand primary: overlines, links, active |
| `--accent-soft` | `color-mix(srgb, accent 14%, transp)`    | Highlights suaves                       |
| `--pad`         | `14px`                                   | Density default (compact 12, comfy 18)  |
| `--radius-card` | `16px`                                   | Border radius cards                     |
| `--title-font`  | `var(--font-fraunces)`                   | Títulos serif                           |
| `--body-font`   | `var(--font-inter)`                      | Body, overlines, labels                 |
| `--mono-font`   | `ui-monospace, SFMono-Regular, Menlo`    | Code blocks                             |
| `--member-1..8` | `#c0825b…#5e7d6f` (8 hex)                | Avatar palette determinística por user  |

### Browser support

`oklch()` y `color-mix()` requieren Safari 16.4+, Chrome 111+, Firefox
113+ (lanzados ~2023). Browsers anteriores reciben fallbacks hex via
`@supports` en `globals.css`. La degradación es estética: la paleta se
ve consistente pero pierde el ajuste fino oklch.

### Member palette: identidad visual, no identifier

8 colores fijos asignados via hash determinístico por `userId`. Para
places ≤150 miembros, hay ~19 miembros por color esperados — colisiones
son aceptables porque la palette **es identidad visual, no
identifier**. El `displayName` y avatar real (cuando hay `imageUrl`)
desambiguan. Cada place puede sobrescribir `memberPalette` via
`themeConfig` para customizar por marca.

## Lo que es configurable (legacy + rebrand)

El admin del place puede cambiar los valores de estas CSS custom
properties, que se aplican dinámicamente al renderizar el place. Tras
F.G, **TODOS** los tokens son configurables (no sólo los `--place-*`):

| Variable                          | Rol                                          |
| --------------------------------- | -------------------------------------------- |
| `--bg` / `--place-bg`             | Fondo del place                              |
| `--surface` / `--place-card-bg`   | Fondo de cards y widgets                     |
| `--soft` / `--place-card-bg-soft` | Variante más oscura para hover, subsecciones |
| `--text` / `--place-text`         | Texto principal                              |
| `--muted` / `--place-text-soft`   | Metadata, hints                              |
| `--border` / `--place-divider`    | Hairlines sutiles                            |
| `--accent` / `--place-mark-bg`    | Brand primary (logo, links, active)          |
| `--member-1..8`                   | Palette de avatares                          |

`--place-*` legacy se mantienen como **aliases** de los tokens nuevos.
Cero rotura para componentes que aún los usan (migración gradual
post-F.G).

## Lo que NO es configurable

- **Tipografía**: Fraunces (italic) + Inter. Es del producto, no de cada place.
- **Estructura**: 4 zonas horizontales máximo, widgets en portada, sin scroll vertical en portada.
- **Comportamiento**: sin pulsos animados, sin badges UPPERCASE, sin countdowns, sin contadores vanidosos.
- **Paleta de burbujas de miembros**: tonos definidos por producto para consistencia cross-place.
- **Presencia viva**: borde verde de las burbujas. Color del presence es fijo del producto.

El admin configura **qué valor toma cada rol**, no la estructura del sistema.

## Presets iniciales

Para facilitar customización sin abrumar, Place provee 4-6 presets visuales (blanco/negro sobrio, papel cálido, noche oscura, verde natural, etc.). El admin elige uno o define colores custom.

## Implementación

Los colores se inyectan en el layout del place como CSS variables en el `<style>` del `<html>` o como inline style en el root element:

```tsx
// En [placeSlug]/layout.tsx
<html style={buildThemeVars(place.themeConfig)}>
```

Donde `buildThemeVars()` genera un objeto con las custom properties a partir del JSON de config:

```typescript
function buildThemeVars(config: ThemeConfig): CSSProperties {
  return {
    '--place-bg': config.bg ?? DEFAULT_THEME.bg,
    '--place-card-bg': config.cardBg ?? DEFAULT_THEME.cardBg,
    // ... etc
  } as CSSProperties
}
```

## Validación de contraste

Al guardar colores custom, el servidor valida que las combinaciones (fondo + texto, card + texto) cumplan ratio de contraste WCAG AA. Si el contraste es insuficiente, se rechaza el cambio con un mensaje claro.

Esto protege la legibilidad independientemente de las elecciones estéticas del admin.

## Tailwind y los temas

Tailwind se usa para layout y spacing, no para colores del place. Los colores siempre vienen de CSS variables:

```tsx
// Bien
<div className="p-4 rounded-xl" style={{ background: 'var(--place-card-bg)' }}>

// Mal
<div className="p-4 rounded-xl bg-gray-100">
```

Razón: cambiar el tema del place no debe requerir recompilar Tailwind ni tocar clases. El cambio es puramente runtime.
