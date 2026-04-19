# Modelo de datos base

Schema Prisma del core del producto. Cada feature agrega sus propias tablas respetando este core.

## Schema base

```prisma
model User {
  id              String   @id @default(cuid())
  email           String   @unique
  displayName     String
  handle          String?  @unique
  avatarUrl       String?
  createdAt       DateTime @default(now())

  memberships     Membership[]
  ownedPlaces     PlaceOwnership[]
}

model Place {
  id              String   @id @default(cuid())
  slug            String   @unique
  name            String
  description     String?

  themeConfig     Json     @default("{}")
  openingHours    Json     @default("{}")

  billingMode     BillingMode
  stripeCustomerId     String?
  stripeSubscriptionId String?
  stripeConnectId      String?

  enabledFeatures Json     @default("[\"conversations\",\"events\",\"members\"]")

  createdAt       DateTime @default(now())
  archivedAt      DateTime?

  memberships     Membership[]
  ownerships      PlaceOwnership[]
  invitations     Invitation[]
}

model Membership {
  id              String   @id @default(cuid())
  userId          String
  placeId         String
  role            MembershipRole @default(MEMBER)
  joinedAt        DateTime @default(now())
  leftAt          DateTime?

  user            User     @relation(fields: [userId], references: [id])
  place           Place    @relation(fields: [placeId], references: [id])

  @@unique([userId, placeId])
}

model PlaceOwnership {
  id              String   @id @default(cuid())
  userId          String
  placeId         String
  grantedAt       DateTime @default(now())

  user            User     @relation(fields: [userId], references: [id])
  place           Place    @relation(fields: [placeId], references: [id])

  @@unique([userId, placeId])
}

model Invitation {
  id              String   @id @default(cuid())
  placeId         String
  email           String
  invitedBy       String
  acceptedAt      DateTime?
  expiresAt       DateTime
  token           String   @unique

  place           Place    @relation(fields: [placeId], references: [id])
}

enum MembershipRole {
  MEMBER
  ADMIN
}

enum BillingMode {
  OWNER_PAYS
  OWNER_PAYS_AND_CHARGES
  SPLIT_AMONG_MEMBERS
}
```

## Invariantes del dominio

Reglas que el código debe enforzar. No son validaciones UI — son invariantes estructurales que viven en el modelo o en domain services.

- **Máximo 150 miembros por place.** Al intentar agregar el miembro 151, el modelo rechaza con error estructural.
- **Mínimo 1 owner por place activo.** Un place no puede quedar sin owner. Si un owner quiere irse, debe transferir primero.
- **Transferencia de ownership requiere que el target sea miembro actual.** No se puede transferir a alguien externo al place.
- **No se pueden mezclar billing modes.** Un place tiene un solo modo activo. Cambiar de modo requiere flow explícito.
- **Slug inmutable.** Ver `multi-tenancy.md`.
- **Un usuario no puede tener dos memberships activas en el mismo place.** Enforzado por unique constraint `@@unique([userId, placeId])`.

## Capas de identidad de un usuario

Ver `docs/ontologia/miembros.md` para el detalle ontológico. En el schema:

- **Capa universal** (en `User`): email, displayName, handle, avatarUrl
- **Capa contextual** (en `Membership` + datos derivados por place): role, fecha de join, contribuciones acumuladas calculadas por feature
- **Capa privada**: settings del usuario, no expuestos a otros

## Derecho al olvido

Cuando un usuario deja un place (`Membership.leftAt` se setea):

- El contenido que creó (mensajes, temas, eventos) queda en el place
- Durante 365 días ese contenido sigue atribuido a su nombre (trazabilidad)
- Pasados los 365 días, un job periódico reemplaza el user reference por un placeholder "ex-miembro"
- Su presencia, lecturas y actividad se borran inmediatamente al salir

Esta política se implementa en `features/members/` con un cron job o scheduled function.

## Convenciones

- IDs son `cuid()`, no autoincrementales. Razón: no exponer conteos de places o users vía URLs secuenciales.
- Soft delete vía `archivedAt` o `leftAt` en lugar de `DELETE` físico. Los hard deletes son operación explícita.
- Timestamps siempre en UTC. La conversión a timezone del usuario es responsabilidad del cliente.
