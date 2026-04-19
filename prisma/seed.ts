import { PrismaClient, BillingMode, MembershipRole } from '@prisma/client'

/**
 * Seed mínimo para desarrollo local.
 * Crea 1 usuario, 1 place en modo OWNER_PAYS, su ownership y membership ADMIN.
 * No se usa en tests E2E (esos arman su propia fixture).
 */
const prisma = new PrismaClient()

async function main() {
  const user = await prisma.user.upsert({
    where: { email: 'seed@place.local' },
    update: {},
    create: {
      email: 'seed@place.local',
      displayName: 'Seed User',
      handle: 'seed',
    },
  })

  const place = await prisma.place.upsert({
    where: { slug: 'prueba' },
    update: {},
    create: {
      slug: 'prueba',
      name: 'Place de prueba',
      description: 'Un lugar seedeado para desarrollo local.',
      billingMode: BillingMode.OWNER_PAYS,
    },
  })

  await prisma.placeOwnership.upsert({
    where: { userId_placeId: { userId: user.id, placeId: place.id } },
    update: {},
    create: { userId: user.id, placeId: place.id },
  })

  await prisma.membership.upsert({
    where: { userId_placeId: { userId: user.id, placeId: place.id } },
    update: {},
    create: {
      userId: user.id,
      placeId: place.id,
      role: MembershipRole.ADMIN,
    },
  })

  console.log(`✓ Seed completo: user=${user.id}, place=${place.slug}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
