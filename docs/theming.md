# Theming y customización visual por place

Cada place tiene su propia identidad visual, configurable por el admin. El producto provee defaults; cada place los personaliza dentro de límites que protegen usabilidad y coherencia.

## Lo que es configurable

El admin del place puede cambiar los valores de estas CSS custom properties, que se aplican dinámicamente al renderizar el place:

| Variable                 | Rol                                          |
| ------------------------ | -------------------------------------------- |
| `--place-bg`             | Fondo del place                              |
| `--place-card-bg`        | Fondo de cards y widgets                     |
| `--place-card-bg-soft`   | Variante más oscura para hover, subsecciones |
| `--place-text`           | Texto principal                              |
| `--place-text-medium`    | Texto secundario                             |
| `--place-text-soft`      | Metadata, hints                              |
| `--place-text-whisper`   | Labels muy discretos                         |
| `--place-link`           | Color de enlaces                             |
| `--place-link-underline` | Color del underline de enlaces               |
| `--place-divider`        | Hairlines sutiles                            |
| `--place-mark-bg`        | Fondo del logo/mark del place                |
| `--place-mark-fg`        | Foreground del logo/mark                     |

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
