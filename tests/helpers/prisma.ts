/**
 * Prisma singleton compartido entre todos los helpers de test (db.ts, time.ts,
 * reset-content.ts). Sin esto, cada helper abría su propio pool y el pooler
 * Supavisor se saturaba cuando varios specs corrían en paralelo.
 *
 * Scaffolding-only: este módulo no se importa desde código de aplicación.
 */

import { PrismaClient } from '@prisma/client'

let _client: PrismaClient | null = null

export function getTestPrisma(): PrismaClient {
  if (!_client) {
    _client = new PrismaClient({
      log: ['error'],
    })
  }
  return _client
}

export async function closeTestPrisma(): Promise<void> {
  if (_client) {
    await _client.$disconnect()
    _client = null
  }
}
