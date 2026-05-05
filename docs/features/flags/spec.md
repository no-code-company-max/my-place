# Flags — Especificación

> **Alcance:** flujo de moderación interna del place. Cualquier miembro reporta contenido (Post, Comment, Event); admin/owner revisa la cola y aplica medidas. Estados terminales — no hay reapertura. Privacidad por diseño: identidad del reporter es admin-only y desaparece post-erasure 365d.

> **Referencias:** `docs/architecture.md` (paradigma de slices), `docs/blueprint.md` (cozytech: nada parpadea, sin fricción artificial), `docs/features/discussions/spec.md` (Post + Comment), `docs/features/events/spec.md` (Event), `docs/features/members/spec.md` (membership como gate), `docs/decisions/2026-04-21-flags-subslice-split.md` (split técnico), `docs/plans/2026-05-01-erasure-coverage-extension.md` (erasure de identidad del reporter).

## 1. Modelo mental

- **Flag es un señalizador, no una acción de moderación.** Un miembro marca contenido para que un admin revise. La acción correctiva (ocultar, borrar, cancelar evento) la decide el admin.
- **Estados terminales.** Un flag nace `OPEN`, llega a `REVIEWED_ACTIONED` o `REVIEWED_DISMISSED`, y ahí muere. No hay reapertura — si un admin se equivoca, el contenido sigue vivo y puede ser flaggeado de nuevo por otro miembro (o por el mismo, post-DISMISSED).
- **Identidad del reporter es admin-only.** El author del contenido reportado nunca sabe quién lo reportó. Post-erasure 365d, la identidad desaparece incluso para el admin.
- **Idempotencia por reporter.** Un mismo miembro no puede reportar el mismo contenido dos veces. El UNIQUE en DB lo enforce; la UI muestra error amistoso.
- **Cross-slice por diseño.** Flags toca Post (`discussions`), Comment (`discussions`), Event (`events`). El slice consume sus targets vía `public.server.ts` de cada uno; nunca importa internals.

## 2. Scope del slice

**En MVP**:

1. **Crear flag** (`flagAction`) sobre Post, Comment o Event.
2. **Listar cola** (`/{placeSlug}/settings/flags`) — solo admin/owner. Paginada por `createdAt DESC`.
3. **Revisar flag** (`reviewFlagAction`) con decisión `REVIEWED_ACTIONED` (con sideEffect) o `REVIEWED_DISMISSED` (sin sideEffect).
4. **SideEffects** combinables con la decisión:
   - `HIDE_TARGET` (solo POST) — setea `Post.hiddenAt`.
   - `DELETE_TARGET` — POST hard-delete; COMMENT soft-delete (`deletedAt`).
   - `CANCEL_EVENT` (solo EVENT) — setea `Event.cancelledAt` reusando la lógica de `cancelEventAction` del slice events.
5. **Privacidad del reporter**: nunca expuesto fuera de `public.server.ts` (admin-only). Post-erasure → `reporterUserId = NULL` + `reporterSnapshot = { displayName: 'ex-miembro' }`.

**Fuera de MVP**:

- Toolbar contextual de moderación inline en PostDetail/CommentItem (hide/delete sin pasar por queue) — diferido.
- Audit log persistente más allá de `pino` logs — diferido.
- Notificaciones al admin cuando llega un flag nuevo (ahora la queue es pull, no push).
- Flags sobre DMs (no existen DMs en MVP).
- Flags sobre miembros (acoso patrón, no contenido específico).
- Appeals flow del flagger ("no estoy de acuerdo con la decisión del admin").

## 3. Modelo de datos

```prisma
model Flag {
  id                  String            @id @default(cuid())
  targetType          ContentTargetKind  // POST | COMMENT | EVENT
  targetId            String
  placeId             String
  // Reporter denormalizado (mismo patrón Post/Comment/Event):
  //  - reporterUserId nullable + FK SetNull → erasure 365d nullifica.
  //  - reporterSnapshot poblado al crear; reescrito a 'ex-miembro' por erasure.
  reporterUserId      String?
  reporterSnapshot    Json
  reason              FlagReason         // SPAM | HARASSMENT | OFFTOPIC | MISINFO | OTHER
  reasonNote          String?            @db.VarChar(500)
  status              FlagStatus         @default(OPEN)
  createdAt           DateTime           @default(now())
  reviewedAt          DateTime?
  reviewerAdminUserId String?            // SetNull si el admin sale + erasure
  reviewNote          String?            @db.VarChar(500)

  @@unique([targetType, targetId, reporterUserId])
  @@index([placeId, status, createdAt(sort: Desc)])
}

enum FlagStatus {
  OPEN
  REVIEWED_ACTIONED
  REVIEWED_DISMISSED
}

enum FlagReason {
  SPAM
  HARASSMENT
  OFFTOPIC
  MISINFO
  OTHER
}
```

**Decisiones del schema**:

- `targetType` polimórfico (no FK al target real) — el target puede ser Post/Comment/Event de slices distintos. La integridad se valida en el action (existe + pertenece al place + no borrado).
- UNIQUE `(targetType, targetId, reporterUserId)` — un user no flagea el mismo target dos veces. Con `reporterUserId` nullable, post-erasure pueden coexistir múltiples flags con `reporterUserId = NULL` sobre el mismo target (ya no importa, son anónimos).
- `reasonNote` y `reviewNote` capeados a 500 chars en DB y schema Zod.
- Sin FK directo a Post/Comment/Event para `targetId`. Cuando el target se hard-deletea (POST con sideEffect DELETE_TARGET), las flags asociadas se eliminan en cascade vía la lógica del action que borra el Post (no por FK constraint).

## 4. Permisos

| Acción                                                    | OWNER                | ADMIN | MEMBER | non-member                |
| --------------------------------------------------------- | -------------------- | ----- | ------ | ------------------------- |
| Crear flag sobre Post/Comment/Event                       | ✅                   | ✅    | ✅     | ❌ (membership requerida) |
| Crear flag sobre contenido propio                         | ✅ (raro pero legal) | ✅    | ✅     | —                         |
| Ver cola de flags `/settings/flags`                       | ✅                   | ✅    | ❌     | ❌                        |
| Revisar flag (`REVIEWED_ACTIONED` / `REVIEWED_DISMISSED`) | ✅                   | ✅    | ❌     | ❌                        |
| Aplicar `HIDE_TARGET` / `DELETE_TARGET` / `CANCEL_EVENT`  | ✅                   | ✅    | ❌     | ❌                        |

`isAdmin` = `Membership.role === 'ADMIN'` **OR** `PlaceOwnership` row presente para el `userId`.

## 5. Estados y transiciones

```
        ┌──[REVIEWED_ACTIONED + sideEffect (opcional)]──> REVIEWED_ACTIONED  (terminal)
OPEN ───┤
        └──[REVIEWED_DISMISSED, sin sideEffect]──────────> REVIEWED_DISMISSED (terminal)
```

- Disparador: solo admin/owner vía `reviewFlagAction`.
- Idempotencia: el UPDATE filtra `WHERE status = 'OPEN'`. Si otro admin ya resolvió → `count = 0` → `NotFoundError` (concurrencia detectada).
- No hay reapertura: si la decisión fue equivocada, el contenido vive en su propio estado. Otro miembro puede crear un flag nuevo (UNIQUE permite porque el viejo ya no es OPEN).

## 6. SideEffects por decisión

| Decisión             | SideEffect      | Target válido | Comportamiento                                                                                |
| -------------------- | --------------- | ------------- | --------------------------------------------------------------------------------------------- |
| `REVIEWED_ACTIONED`  | `HIDE_TARGET`   | POST          | `Post.hiddenAt = now()`. Miembros ven 404 en thread; admin ve con badge "oculto".             |
| `REVIEWED_ACTIONED`  | `DELETE_TARGET` | POST          | Hard-delete del Post (cascade a Comment/Reaction/PostRead/Flag).                              |
| `REVIEWED_ACTIONED`  | `DELETE_TARGET` | COMMENT       | Soft-delete: `Comment.deletedAt = now()`. UI muestra `[mensaje eliminado]`.                   |
| `REVIEWED_ACTIONED`  | `CANCEL_EVENT`  | EVENT         | `Event.cancelledAt = now()` reusando `cancelEventAction` (idempotente).                       |
| `REVIEWED_ACTIONED`  | _(ninguno)_     | cualquiera    | Marca el flag como tratado sin tocar el contenido (ej: el admin habló con el author offline). |
| `REVIEWED_DISMISSED` | _(no aplica)_   | cualquiera    | Schema refine: `DISMISSED + sideEffect ≠ none → ValidationError`.                             |

**Combinaciones inválidas** (Zod refine + runtime validation):

- `HIDE_TARGET` sobre COMMENT — los comentarios se eliminan, no se ocultan (no tienen `hiddenAt`).
- `HIDE_TARGET` o `DELETE_TARGET` sobre EVENT — los eventos se cancelan (estado distinto).
- `CANCEL_EVENT` sobre POST/COMMENT — no tiene sentido semántico.
- `REVIEWED_DISMISSED` con cualquier sideEffect.

## 7. Privacidad del reporter

**Garantía de producto**: la identidad del reporter NO importa en MVP. Solo el admin necesita saberla para evitar que un mismo user spamee la queue. Después de 365d post-`leftAt`, ni el admin la ve.

- **Mientras el reporter es miembro activo**: `reporterUserId` apunta al User. `reporterSnapshot` capturado al crear refleja su `displayName + avatarUrl` actuales. El admin queue muestra el snapshot.
- **Post-erasure 365d** (job `runErasure`): `reporterUserId = NULL`, `reporterSnapshot = { displayName: 'ex-miembro', avatarUrl: null }`. La queue muestra "ex-miembro" para el admin.
- **Author del contenido reportado**: nunca ve quién lo reportó. La queue es admin-only; las queries públicas (`flags/public.ts`) no exponen `reporterUserId` ni `reporterSnapshot`. Solo `flags/public.server.ts` lo proyecta para el queue admin.
- **`reviewerAdminUserId`**: análogo. Si el admin reviewer sale del place + 365d → SetNull. El flag queda con resolución registrada pero sin nombre del admin.

## 8. RLS

Definido en `prisma/migrations/20260422000100_discussions_rls/migration.sql` líneas 233-260.

- **SELECT**: admin del place ve todos los flags del place. Member ve solo los flags que él mismo creó (mientras `reporterUserId = auth.uid()`). Post-erasure su `reporterUserId` es NULL → no recupera nada (es coherente: ya no es miembro).
- **INSERT**: cualquier miembro activo. La policy enforce `reporterUserId = auth.uid()` (no se puede flagear "en nombre de otro").
- **UPDATE**: admin only. La policy aplica al `reviewFlagAction`.
- **DELETE**: ningún rol vía RLS. Las flags se eliminan solo en cascade cuando el Post asociado se hard-deletea.

## 9. Invariantes

| Invariante                                      | Nivel     | Cómo se enforce                                                                                                |
| ----------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------- |
| Un reporter no flagea el mismo target dos veces | DB        | UNIQUE `(targetType, targetId, reporterUserId)` + `P2002` traducido a `FlagAlreadyExists` (ConflictError 409). |
| Reportes solo sobre contenido vivo              | App       | El action verifica que el target existe; comments con `deletedAt NOT NULL` → `NotFoundError`.                  |
| Flag terminal: no hay reapertura                | App       | El UPDATE filtra `WHERE status = 'OPEN'`. count=0 → `NotFoundError`.                                           |
| `DISMISSED` no admite sideEffect                | App       | Zod refine en `reviewFlagInputSchema` + check defensivo runtime.                                               |
| `HIDE_TARGET` solo sobre POST                   | App       | Action rechaza con `ValidationError` si target ≠ POST.                                                         |
| `CANCEL_EVENT` solo sobre EVENT                 | App       | Action rechaza si target ≠ EVENT.                                                                              |
| Reporter visible solo a admin                   | App + RLS | RLS filtra SELECT; queries públicas no proyectan `reporterUserId`.                                             |
| Post-erasure 365d: identidad anonimizada        | Job       | `runErasure` setea NULL + 'ex-miembro'.                                                                        |
| `reasonNote`/`reviewNote` ≤ 500 chars           | DB + App  | `@db.VarChar(500)` + Zod schema.                                                                               |

## 10. Errores estructurados

| Error                                       | Código          | Cuándo                                                                                 |
| ------------------------------------------- | --------------- | -------------------------------------------------------------------------------------- |
| `ValidationError`                           | `VALIDATION`    | Zod parse falla; combinación inválida decision/sideEffect.                             |
| `AuthorizationError`                        | `AUTHORIZATION` | Member no admin invoca `reviewFlagAction`; no member llama `flagAction`.               |
| `NotFoundError`                             | `NOT_FOUND`     | Target no existe (post/comment/event) o ya borrado; flag ya resuelto por concurrencia. |
| `ConflictError` (alias `FlagAlreadyExists`) | `CONFLICT`      | UNIQUE violation: el reporter ya creó un flag sobre este target.                       |

Todos extienden `DomainError` (`src/shared/errors/domain-error.ts`). Mapeo a copy amistoso en `src/features/flags/ui/errors.ts` (o donde corresponda en cada caller).

## 11. UI flows

### Flagger (member)

1. Ve un Post / Comment / Event problemático.
2. Click en `<FlagButton>` (icono bandera).
3. Modal abre con `<select>` de `FlagReason` + textarea opcional `reasonNote`.
4. Submit → `flagAction` server action.
5. Success: toast "Gracias, lo revisamos." + modal close.
6. `FlagAlreadyExists`: toast "Ya reportaste este contenido."
7. Otros errores: toast con `friendly*ErrorMessage`.

### Admin reviewer

1. Va a `/{placeSlug}/settings/flags` (link en settings).
2. Lista paginada de `OPEN` flags ordenados por `createdAt DESC`. Cada item:
   - Snapshot del target (preview ~160 chars).
   - Nombre del reporter (de `reporterSnapshot.displayName`; "ex-miembro" si fue anonimizado).
   - Reason + reasonNote.
3. Click en item abre acciones: `<select>` de decisión (ACTIONED/DISMISSED) + `<select>` opcional de sideEffect + textarea `reviewNote`.
4. Submit → `reviewFlagAction`.
5. La queue se revalida; el flag desaparece del listado (ahora terminal).

## 12. Verificación

**Unit tests**:

- `src/features/flags/__tests__/create.test.ts` — happy + duplicate + target-not-found + auth-deny + validation.
- `src/features/flags/__tests__/review.test.ts` — happy ACTIONED + DISMISSED + concurrency + permission + sideEffect combinations + EVENT cancel.
- `src/features/flags/domain/__tests__/` — funciones puras (validations, refine).

**RLS tests**:

- `tests/rls/flag.test.ts` — SELECT (admin vs reporter vs other), INSERT (member vs non), UPDATE (admin only), no DELETE.

**E2E**:

- `tests/e2e/flows/moderation.spec.ts` (existente) — flagger reporta, admin revisa, content state cambia. Cubrir `EVENT + CANCEL_EVENT` cuando el gap G2 se cierre.

**Manual smoke**:

- Flagger reporta su propio post → permitido (raro pero legal).
- Admin DISMISSED + sideEffect HIDE → ValidationError visible en UI.
- 2 admins resuelven el mismo flag concurrentemente → uno gana, el otro recibe `NotFoundError` graceful.
- Post-erasure de un reporter → su flag muestra "ex-miembro" en queue.
