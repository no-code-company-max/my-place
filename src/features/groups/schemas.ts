/**
 * Zod schemas de input de las server actions del slice `groups` (G.2).
 *
 * Validan estructura del input que viene del cliente. Las reglas de
 * negocio (preset no se modifica, target no es owner, etc.) viven en
 * las propias actions — Zod cubre estructura.
 *
 * Ver `docs/features/groups/spec.md` § 10.
 *
 * **S1b (2026-05-13):** removidos `categoryScopeIds` (group-level scope
 * por categoría library) — la table `GroupCategoryScope` se eliminó.
 * Los permisos `library:*` aplican ahora globalmente al place. Ver ADR
 * `docs/decisions/2026-05-12-library-permissions-model.md`.
 */

import { z } from 'zod'
import {
  GROUP_DESCRIPTION_MAX_LENGTH,
  GROUP_NAME_MAX_LENGTH,
  GROUP_NAME_MIN_LENGTH,
} from './domain/invariants'
import { PERMISSIONS_ALL } from './domain/permissions'

const placeSlugSchema = z.string().min(1).max(80)
const userIdSchema = z.string().min(1)
const groupIdSchema = z.string().min(1)

/**
 * Enum Zod del set hardcoded de permisos. Se construye con `z.enum` a
 * partir de `PERMISSIONS_ALL` para que el TypeScript del schema
 * matchee 1-a-1 con `Permission`.
 */
export const permissionEnumSchema = z.enum(
  PERMISSIONS_ALL as unknown as readonly [string, ...string[]],
)

const nameSchema = z.string().trim().min(GROUP_NAME_MIN_LENGTH).max(GROUP_NAME_MAX_LENGTH)

const descriptionSchema = z
  .string()
  .trim()
  .max(GROUP_DESCRIPTION_MAX_LENGTH)
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined))

const permissionsSchema = z.array(permissionEnumSchema).max(PERMISSIONS_ALL.length)

export const createGroupInputSchema = z.object({
  placeSlug: placeSlugSchema,
  name: nameSchema,
  description: descriptionSchema,
  permissions: permissionsSchema,
})
export type CreateGroupInput = z.infer<typeof createGroupInputSchema>

export const updateGroupInputSchema = z.object({
  groupId: groupIdSchema,
  name: nameSchema,
  description: descriptionSchema,
  permissions: permissionsSchema,
})
export type UpdateGroupInput = z.infer<typeof updateGroupInputSchema>

export const deleteGroupInputSchema = z.object({
  groupId: groupIdSchema,
})
export type DeleteGroupInput = z.infer<typeof deleteGroupInputSchema>

export const addMemberToGroupInputSchema = z.object({
  groupId: groupIdSchema,
  userId: userIdSchema,
})
export type AddMemberToGroupInput = z.infer<typeof addMemberToGroupInputSchema>

export const removeMemberFromGroupInputSchema = z.object({
  groupId: groupIdSchema,
  userId: userIdSchema,
})
export type RemoveMemberFromGroupInput = z.infer<typeof removeMemberFromGroupInputSchema>
