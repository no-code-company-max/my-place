import { PrismaClient } from '@prisma/client'

/**
 * Singleton de PrismaClient.
 * El pattern `globalThis` evita múltiples instancias durante hot-reload en dev
 * (cada recarga crearía una conexión nueva y agotaría el pool).
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
