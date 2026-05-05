# Tiers — Especificación

> **Alcance v1 (T.x, 2026-05-02)**: definición + CRUD owner-only de la
> primitiva `Tier` (segmentos de usuarios con precio + duración +
> visibilidad). NO incluye pagos, NO incluye asignación de tiers a
> miembros, NO incluye paywall ni gating de contenido. Esos planes
> son posteriores y construyen encima de esta base.

> **Referencias:** `CLAUDE.md` (principios no negociables),
> `docs/architecture.md` (vertical slices, RSC default),
> `docs/decisions/2026-05-02-tier-model.md` (ADR del modelo),
> `docs/decisions/2026-05-01-stripe-deferred-to-phase-3.md`
> (billing como Fase 3),
> `docs/decisions/2026-05-01-rls-comprehensive-pre-launch.md`
> (RLS unificado deferred — incluye Tier),
> `docs/features/library/spec.md` § 11 (matriz de permisos —
> patrón replicado), `docs/features/shell/spec.md` § 18
> (Settings affordances — extensión leve para owner-only).

## 1. Modelo mental

Un **tier** es un segmento de usuarios del place — la unidad
con la que el **owner** va a, en el futuro, cobrar membresías.
Cada tier define un nombre, una descripción opcional, un precio
en centavos, una moneda, una duración (cuánto vale antes de
renovarse) y una visibilidad (publicado u oculto).

Esta primera fase NO conecta nada de pagos ni asigna tiers a
miembros. Lo único que entrega es la entidad y el CRUD owner-only.
Beneficio: el owner puede planear su pricing structure con UI
real, en producción, antes de que Stripe/MP estén integrados.
Cuando lleguen, el modelo no cambia — se le suma `TierMembership`
y los handlers de webhook.

**No es:**

- Un plan de suscripción activo (no hay cobro automático).
- Una asignación de tier a usuarios (sin tabla `TierMembership` v1).
- Un paywall ni gate de contenido (categorías de library, eventos,
  place completo siguen abiertos a todos los miembros).

**Es:**

- La definición ontológica de los segmentos que el place ofrecerá.
- Un CRUD owner-only en `/settings/tiers` con form crear/editar
  y toggle de visibilidad.

## 2. Vocabulario

- **Tier**: registro de la tabla `Tier` — `{ id, placeId, name,
description, priceCents, currency, duration, visibility,
createdAt, updatedAt }`.
- **Owner del place**: viewer con `PlaceOwnership` activa para el
  place. Único rol que puede crear/editar tiers. `Member.role =
ADMIN` NO califica — admin y owner son orthogonal en este feature
  (decisión `tier-model.md`).
- **Visibilidad**: `PUBLISHED` (visible a todos los miembros del
  place — por ahora en pricing pages futuros) o `HIDDEN` (oculto
  para members; el owner sigue viéndolo en `/settings/tiers` para
  editarlo o re-publicarlo).
- **Precio en centavos**: `priceCents Int`. Evita float drift.
  `0` ⇒ tier gratis (caso "colaboradores"). `> 0` ⇒ tier de pago
  (sin cobro automático todavía).
- **Currency**: `String @db.VarChar(3)`. v1 hardcodea `'USD'`.
  Allowlist se extiende cuando llegue Stripe Connect (USD/BRL/MXN
  para LATAM).
- **Duración**: enum `TierDuration` con 6 valores canónicos —
  `SEVEN_DAYS`, `FIFTEEN_DAYS`, `ONE_MONTH`, `THREE_MONTHS`,
  `SIX_MONTHS`, `ONE_YEAR`. Helper puro `tierDurationToDays()`
  deriva días concretos.

**Idioma**: UI labels en español ("Tiers", "Nuevo tier",
"Publicado", "Oculto", "Gratis", "Editar", "Configuración del
tier"). Código en inglés (`Tier`, `TierDuration`,
`createTierAction`, `priceCents`, etc.).

## 3. Scope v1 (T.x) — cerrado

**Sí en v1**:

- Modelo `Tier` (Prisma) + migration de schema.
- Slice `src/features/tiers/` con domain, queries, actions, UI.
- Server actions: `createTierAction`, `updateTierAction`,
  `setTierVisibilityAction`.
- Queries: `listTiersByPlace`, `findTierById`.
- Page `/settings/tiers` (owner-only).
- UI: lista de tiers + dialog form crear/editar + toggle
  visibilidad.
- Item "Tiers" en `<SettingsNavFab>` con `requiredRole: 'owner'`.
- Helper `formatPrice(priceCents, currency)` en `src/shared/lib/`.
- ADR del modelo (`docs/decisions/2026-05-02-tier-model.md`).
- Tests unit (dominio + queries + actions) + E2E.
- **Owner-only enforcement vía app layer** (server actions +
  UI gate). Defense-in-depth a nivel DB se posterga.

**NO en v1, deferred**:

- **RLS policies**. Decisión user 2026-05-02: el RLS de toda la
  app se aborda en plan unificado posterior (ver
  `docs/decisions/2026-05-01-rls-comprehensive-pre-launch.md`).
  En v1, el access control se hace en server actions con
  `findPlaceOwnership` + UI gate con `perms.isOwner`. Ningún
  query sin filtro explícito por `placeId` y viewer flag.
- **Integración con medios de pago** (Stripe Connect Express, MP).
  Diferida a Fase 3 (`docs/decisions/2026-05-01-stripe-deferred-to-phase-3.md`).
- **`TierMembership`** (asignación de tier a usuarios + cobro).
- **Paywall** / gating de contenido (categorías de library,
  eventos, place completo).
- **Hard-delete de tier** (solo soft via `visibility = HIDDEN`
  en v1).
- **Selector de currency** (hardcode `'USD'` en v1; allowlist
  cuando llegue Stripe).
- **Trial periods, refunds, promo codes**.

## 4. Routes y comportamiento

### `/settings/tiers` (owner-only)

Server Component. Gate del page mismo:

```tsx
const place = await loadPlaceBySlug(placeSlug)
if (!place) notFound()
const auth = await requireAuthUserId('Necesitás iniciar sesión.')
const perms = await findMemberPermissions(auth, place.id)
if (!perms.isOwner) notFound() // member o admin → 404

const tiers = await listTiersByPlace(place.id, perms.isOwner)

return (
  <section className="flex flex-col gap-4 pb-6">
    <SettingsHeader title="Tiers" />
    <TiersListAdmin tiers={tiers} />
    <NewTierButton />
  </section>
)
```

`<TiersListAdmin>` (Server) renderiza `<TierCard>` por cada tier.
`<TierCard>` (Server) muestra: nombre, badge de visibilidad
("Publicado" / "Oculto"), precio formateado (helper
`formatPrice`), duración legible (helper
`tierDurationLabel(duration)`), botón "Editar" (abre dialog) y
toggle de visibilidad.

`<NewTierButton>` (Server) abre `<TierFormDialog mode="create">`.
`<TierFormDialog>` (Client): form con name + description +
priceCents + duration. Currency hidden (auto `'USD'` v1).
Visibility no aparece — al crear, default `HIDDEN`.

### Cross-zona

NO existe `/tiers` público en v1. Los tiers viven sólo en
`/settings/tiers` (owner-only). Cuando lleguen los pricing pages
futuros, el page público leerá tiers con `visibility = PUBLISHED`
(query con `viewerIsOwner: false`).

## 5. Componentes UI

Listado en `src/features/tiers/ui/`. Server Components default;
Client sólo donde hace falta interactividad o transition.

| Componente         | Tipo   | Props                  | Reuse                                                              |
| ------------------ | ------ | ---------------------- | ------------------------------------------------------------------ |
| `TiersListAdmin`   | Server | `tiers: Tier[]`        | nuevo                                                              |
| `TierCard`         | Server | `tier: Tier`           | nuevo (renderiza `<VisibilityToggle>` como Client island)          |
| `TierFormDialog`   | Client | `mode`, `initial?`     | reusa `<Dialog>` shared, patrón `<CategoryFormDialog>` (library)   |
| `VisibilityToggle` | Client | `tierId`, `visibility` | reusa `<Switch>` o `<Button>` shared, `useTransition` para pending |
| `NewTierButton`    | Server | none                   | `<Link>` o trigger del dialog vía Client wrapper                   |

`<TierFormDialog>` y `<VisibilityToggle>` usan `useTransition` +
pending state para botón submit con label dinámico ("Creando…",
"Guardando…", "Cambiando…"). Patrón reusado de
`library/ui/admin/category-form-dialog.tsx`.

`<TierCard>` permanece Server Component aunque incluya un Client
island (`<VisibilityToggle>`) — patrón validado en library admin.
No hay riesgo de boundary client-server porque `<TierCard>`
nunca se renderiza dentro de un Client Component (solo dentro
de `<TiersListAdmin>` RSC).

## 6. Empty states

**Owner sin tiers**: empty state con copy

- Emoji 🏷️
- Título: "Todavía no creaste tiers"
- Subtitle: "Definí los segmentos con los que vas a estructurar
  la membresía de tu place. Empezá con uno gratuito o uno
  pago — los tiers nuevos arrancan ocultos."
- CTA: "Nuevo tier →" (abre dialog).

**No empty para member** — la page entera retorna 404 antes de
renderizar el listado.

## 7. Permisos (matriz canónica)

Vocabulario:

- **owner del place**: viewer con `PlaceOwnership` activa para el
  place.
- **admin**: `Member.role = 'ADMIN'` sin ownership.
- **member común**: `Member.role = 'MEMBER'` sin ownership.

| Acción                                        | owner | admin | member común |
| --------------------------------------------- | ----- | ----- | ------------ |
| Ver `/settings/tiers`                         | ✓     | —     | —            |
| Ver item "Tiers" en `<SettingsNavFab>`        | ✓     | —     | —            |
| Crear tier                                    | ✓     | —     | —            |
| Editar tier (name/description/price/duration) | ✓     | —     | —            |
| Cambiar visibilidad (publicar/ocultar)        | ✓     | —     | —            |
| Listar tiers `PUBLISHED` (futuro)             | ✓     | ✓     | ✓            |
| Listar tiers `HIDDEN`                         | ✓     | —     | —            |
| Hard-delete                                   | —     | —     | —            |

Defense-in-depth aplicado:

1. **UI gate** (`/settings/tiers/page.tsx`): `if (!perms.isOwner) notFound()`.
2. **UI filter** (`<SettingsNavFab>`): item "Tiers" filtrado por
   `requiredRole: 'owner'` cuando `isOwner === false`.
3. **Server action gate**: cada action llama
   `findPlaceOwnership(actorId, placeId)` antes de cualquier
   mutación. Si null → `AuthorizationError`.
4. **Query gate**: `listTiersByPlace(placeId, viewerIsOwner)` y
   `findTierById(tierId, viewerIsOwner)` reciben el flag
   explícito. Si `!viewerIsOwner`, filtran a `visibility =
PUBLISHED` (en `findTierById` retornan `null` si el tier es
   `HIDDEN` — evita enumeración).

**RLS** se suma como cuarta capa cuando llegue el plan unificado
(`docs/decisions/2026-05-01-rls-comprehensive-pre-launch.md`).
Comportamiento esperado entonces:

- SELECT: `is_active_member("placeId") AND (visibility = 'PUBLISHED' OR is_place_owner("placeId"))`.
- INSERT/UPDATE: `is_place_owner("placeId")`.
- DELETE: bloqueado (soft via visibility).

## 8. Modelo de datos

```prisma
model Tier {
  id          String          @id @default(cuid())
  placeId     String
  name        String          @db.VarChar(60)
  description String?         @db.VarChar(280)
  priceCents  Int             // 0 = gratis; sin negativos (cap defensivo en Zod: max 999_999)
  currency    String          @db.VarChar(3) @default("USD")
  duration    TierDuration
  visibility  TierVisibility  @default(HIDDEN)  // los nuevos arrancan ocultos
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt

  place       Place           @relation(fields: [placeId], references: [id], onDelete: Cascade)

  @@index([placeId, visibility])
  @@index([placeId, createdAt])
  // PARTIAL UNIQUE INDEX (no soportado declarativo en Prisma 5):
  //   Tier_placeId_lowerName_published_unique
  //   ON ("placeId", LOWER("name")) WHERE "visibility" = 'PUBLISHED'
  // Definido en migration `20260502010000_tier_published_name_unique`.
  // Garantiza máx 1 tier PUBLISHED por (placeId, name) lower-case.
}

enum TierDuration {
  SEVEN_DAYS
  FIFTEEN_DAYS
  ONE_MONTH
  THREE_MONTHS
  SIX_MONTHS
  ONE_YEAR
}

enum TierVisibility {
  PUBLISHED
  HIDDEN
}
```

**Decisiones clave** (full rationale en
`docs/decisions/2026-05-02-tier-model.md`):

- `id` es **cuid** generado por Prisma. NO unique constraint
  global sobre `(placeId, name)` — el owner puede tener N tiers
  con el mismo nombre. **Partial unique** sobre
  `(placeId, LOWER(name)) WHERE visibility = 'PUBLISHED'`
  garantiza máx 1 publicado por nombre. Caso de uso: owner
  mantiene "Basic" $1.99 (HIDDEN) por compatibilidad histórica
  - "Basic" $2.99 (PUBLISHED) como oferta actual. Identidad de
    cada tier es el `id`.
- Sin `slug` en v1 — los tiers no tienen URL pública dedicada.
- Sin `archivedAt` en v1 — la visibilidad cubre el caso
  "deshabilitar sin perder". Archive verdadero se evalúa en v2
  cuando exista `TierMembership` y haya FK constraint.
- `onDelete: Cascade` desde Place — si el Place se hard-deletea
  (caso erasure futuro), sus tiers se borran. Place soft-archive
  (`Place.archivedAt`) NO cascadea.
- `priceCents = 0` legal y semántico ("Gratis"). Cap defensivo
  Zod `max(999_999)` ($9,999.99) ajustable cuando llegue Stripe.
- `currency = 'USD'` hardcoded v1 vía Zod `z.enum(['USD'])`.
- `visibility` default `HIDDEN` — los tiers nuevos arrancan
  ocultos. Owner los publica explícitamente. Evita exponer
  accidentalmente un tier mal configurado.
- Indexes:
  - `(placeId, visibility)` para el filtro del owner (que pide
    todos) vs pricing pages futuras (que piden solo PUBLISHED).
  - `(placeId, createdAt)` para sort de la lista admin.

### 8.1 Reglas de inmutabilidad post-create — preparación para futuro

| Campo         | v1               | v2 (con TierMembership)                                        |
| ------------- | ---------------- | -------------------------------------------------------------- |
| `name`        | editable siempre | editable siempre                                               |
| `description` | editable siempre | editable siempre                                               |
| `priceCents`  | editable siempre | **inmutable** post-publish — owner debe archivar y crear nuevo |
| `currency`    | editable siempre | **inmutable** post-publish                                     |
| `duration`    | editable siempre | **inmutable** post-publish                                     |
| `visibility`  | editable siempre | editable siempre (es el toggle)                                |

Documentado como gotcha futuro en este spec. v2 introduce
inmutabilidad post-publish para no romper la semántica de
suscripciones existentes.

## 9. Validación (Zod) — contrato de inputs

Schemas en `tiers/schemas.ts`:

- `name`: `z.string().trim().min(1).max(60)`.
- `description`: `z.string().trim().max(280).optional().nullable()`.
- `priceCents`: `z.number().int().min(0).max(999_999)` ($0–$9,999.99).
- `currency`: `z.enum(['USD']).default('USD')`.
- `duration`: `z.nativeEnum(TierDuration)`.
- `visibility`: `z.nativeEnum(TierVisibility)` — sólo
  `setTierVisibilityAction` la recibe; `createTierAction` y
  `updateTierAction` no aceptan visibility (default `HIDDEN` al
  crear; edición sólo por toggle dedicado).

**Sin dedup global de nombre** (decisión #11 ADR actualizada
2026-05-02). N tiers con el mismo nombre case-insensitive pueden
coexistir en el mismo place — siempre que máximo UNO esté
`PUBLISHED`. La invariante real ("máx 1 PUBLISHED por (placeId,
name) lower-case") la garantiza el partial unique index DB-level

- chequeo pre-update + catch P2002 en las actions. Ver § 10.

## 10. Server actions

### `createTierAction(input) → { ok: true; tierId }`

Owner-only. Sin chequeo de duplicados — los nuevos arrancan
`HIDDEN` por default y nunca pueden violar el partial unique
(que sólo cubre `PUBLISHED`). Errores no esperados (auth fail,
place archivado, validación) → throw.

### `updateTierAction(input) → UpdateTierResult`

```ts
type UpdateTierResult = { ok: true } | { ok: false; error: 'name_already_published' }
```

Owner-only. Editable: `name`, `description`, `priceCents`,
`currency`, `duration`. NO permite cambiar `visibility` (toggle
dedicado).

**Chequeo de colisión** sólo si el tier que se edita está
`PUBLISHED` y el `name` cambia (case-insensitive):

```ts
if (tier.visibility === 'PUBLISHED' && nameChanged) {
  const collision = await prisma.tier.findFirst({
    where: {
      placeId: place.id,
      visibility: 'PUBLISHED',
      name: { equals: trimmedName, mode: 'insensitive' },
      NOT: { id: tier.id },
    },
  })
  if (collision) return { ok: false, error: 'name_already_published' }
}
```

`P2002` del partial unique se catchea como fallback (race) y se
mapea al mismo `name_already_published`.

### `setTierVisibilityAction(input) → SetTierVisibilityResult`

```ts
type SetTierVisibilityResult =
  | { ok: true; visibility: TierVisibility; changed: boolean }
  | { ok: false; error: 'name_already_published' }
```

Owner-only. Idempotente: si ya está en la visibility solicitada,
retorna `{ ok: true, changed: false }` sin update ni revalidate.

**Chequeo de colisión** sólo al transicionar a `PUBLISHED`:

```ts
if (targetVisibility === 'PUBLISHED') {
  const collision = await prisma.tier.findFirst({
    where: {
      placeId: place.id,
      visibility: 'PUBLISHED',
      name: { equals: tier.name, mode: 'insensitive' },
      NOT: { id: tier.id },
    },
  })
  if (collision) return { ok: false, error: 'name_already_published' }
}
```

`P2002` del partial unique se catchea como fallback (race).
`PUBLISHED → HIDDEN` nunca colisiona.

Todas las actions revalidan `/${placeSlug}/settings/tiers`.

**Por qué discriminated union return en vez de throw**: Next 15
NO preserva propiedades custom (`code`, `context`) ni `message` de
un Error tirado desde un Server Action — el cliente sólo recibe
`digest` + 500 opaco. El cliente UI no podría discriminar el copy
friendly del genérico. Para errores **esperados** del flujo (como
`name_already_published`) usamos return; para errores **no
esperados** (auth, notfound, validación) seguimos con throw —
esos sí deben crashear porque indican misuse o estado corrupto.

## 11. Helper `formatPrice(priceCents, currency)`

Vive en `src/shared/lib/format-price.ts` (ubicación shared
porque se anticipa reuso en pricing pages futuros y en otros
features financieros — events ticketing futuro, etc.).

**Comportamiento**:

- `formatPrice(0, 'USD') === 'Gratis'`.
- `formatPrice(199, 'USD')` → `'USD 1,99'` (o equivalente que
  devuelva `Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD' })`).
- Decimal separator coma (locale `'es-AR'`).
- Edge: `formatPrice(999_999, 'USD')` no overflow.

**Decisión locale tomada en T.0** (no diferida): `'es-AR'` con
`Intl.NumberFormat`. Razones:

1. UI del producto en español (CLAUDE.md § Idioma).
2. La mayoría de places del MVP están en Argentina (decisión
   producto).
3. `Intl.NumberFormat` es estándar web — sin libs externas, sin
   bundle weight, soporta cualquier currency cuando llegue
   Stripe Connect.

## 12. Settings nav extension

`src/features/shell/domain/settings-sections.ts` se extiende:

1. Tipo `SettingsSection` gana campo opcional
   `requiredRole?: 'owner' | 'admin'`. Default ausente = visible
   a admin-or-owner (comportamiento actual).
2. Item nuevo `{ slug: 'tiers', label: 'Tiers', requiredRole: 'owner' }`.
3. Helper puro `deriveVisibleSettingsSections({ isOwner }: { isOwner: boolean }): SettingsSection[]`.
   El gate vive en la **data layer**, no en el componente — facilita
   tests puros sin renderizar.

`src/features/shell/ui/settings-nav-fab.tsx` recibe prop
`isOwner: boolean` (default `false` para retrocompatibilidad de
callers no migrados), llama
`deriveVisibleSettingsSections({ isOwner })`, mapea el resultado.

`src/app/[placeSlug]/settings/layout.tsx` ya tiene
`perms = await findMemberPermissions(auth, place.id)` con
`perms.isOwner` — pasarlo es 1 línea:

```tsx
<SettingsNavFab isOwner={perms.isOwner} />
```

## 13. Principios no negociables aplicados (CLAUDE.md)

- **"Sin métricas vanidosas"**: la lista de tiers no muestra
  contador de "miembros suscriptos" ni "ingresos del mes" — eso
  es feature de v2 y aun así, sólo si producto lo justifica
  (no vanity).
- **"Sin urgencia artificial"**: no hay countdowns, "EARLY BIRD",
  "ÚLTIMA CHANCE". Tier creation es tranquila.
- **"Sin gamificación"**: no hay "tiers más populares",
  "ranking de pricing", achievements.
- **"Customización activa, no algorítmica"**: el owner define
  los tiers — no hay "tiers sugeridos por IA" ni templates
  generados.
- **"Memoria preservada"**: HIDDEN preserva el tier sin
  borrarlo. Si el owner cambia de estrategia, puede re-publicar
  o duplicar (mismo nombre permitido — decisión #11).
- **"Lugares pequeños"**: NO cap on tier count en v1, pero el
  cap soft del producto (150 miembros por place) acota
  naturalmente el número de tiers útiles. Si testing surface
  exceso (>20 tiers), se suma cap en v2.

## 14. Sub-fases — cierre del plan

| Sub       | Tema                                              | Sesiones | Deliverable                                                                                                    | Estado    |
| --------- | ------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------- | --------- |
| **T.0**   | Spec + ADR (este doc).                            | 1        | `docs/features/tiers/spec.md` + `docs/decisions/2026-05-02-tier-model.md`                                      | en curso  |
| **T.1**   | Schema + migration aplicada al cloud dev.         | 0.5      | `prisma/migrations/<ts>_tiers_core_schema/` + Prisma generate.                                                 | pendiente |
| **T.2**   | Domain + queries + tests dominio.                 | 1        | `tiers/domain/*` + `tiers/server/queries.ts` + tests puros + tests queries con mock prisma.                    | pendiente |
| **T.3**   | Server actions + helper `formatPrice` + tests.    | 1        | 3 actions con Zod + owner gate + `src/shared/lib/format-price.ts` + tests.                                     | pendiente |
| **T.4**   | UI settings/tiers + Settings nav extension + E2E. | 1-2      | Page + form dialog + list + tier card + visibility toggle + extensión de `SETTINGS_SECTIONS` + tests UI + E2E. | pendiente |
| **Total** |                                                   | 4.5-5.5  |                                                                                                                |           |

## 15. Verificación

### Por sub-fase

- typecheck + lint + tests targeted al slice modificado.

### Cuando T.4 cierre (final)

- typecheck + lint + suite completa (Vitest + E2E). RLS suite
  no aplica (deferida).
- Build prod limpio.
- Manual smoke en dev local:
  1. Owner entra a `/settings/tiers` → ve empty state + CTA
     "Nuevo tier".
  2. Owner crea tier "Básico" ($1.99 USD, 1 mes, descripción) →
     arranca HIDDEN.
  3. Owner crea tier "Colaboradores" ($0 USD, 1 año, sin
     descripción) → arranca HIDDEN, label muestra "Gratis".
  4. Owner ve ambos tiers en lista con badge "Oculto".
  5. Owner publica "Básico" (toggle) → badge cambia a
     "Publicado", pending state visible durante la mutación.
  6. Owner edita name de "Básico" → cambio reflejado.
  7. Owner crea SEGUNDO tier "Básico" ($2.99 USD, 1 mes) — OK,
     arranca HIDDEN. Coexisten dos "Básico" (uno PUBLISHED,
     uno HIDDEN).
  8. Owner intenta publicar el segundo "Básico" → toast: "Ya
     hay otro tier publicado con ese nombre. Ocultalo antes de
     publicar este."
  9. Owner oculta el primer "Básico" → publica el segundo OK.
  10. Admin (no owner) entra a `/settings/tiers` → 404.
  11. `<SettingsNavFab>` no muestra item "Tiers" para admin
      (sólo para owner).
  12. Member común entra a URL directa `/settings/tiers` → 404.
- E2E spec cubre los escenarios: owner CRUD happy path (free +
  paid), N tiers HIDDEN con mismo name coexisten, publicar
  segundo con mismo name → bloqueado, admin gateado en page,
  admin no ve item en FAB, member gateado, validación Zod
  (priceCents negativo, name vacío, name > 60 chars).
