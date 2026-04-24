/**
 * Tipos del job de erasure 365d (C.L). Privados al sub-slice
 * `features/members/server/erasure/`.
 */

export type ErasureRunResult = {
  dryRun: boolean
  membershipsProcessed: number
  postsAnonymized: number
  commentsAnonymized: number
  errorsPerMembership: Array<{ membershipId: string; error: string }>
}

export type ErasureMembershipCounts = {
  posts: number
  comments: number
}

/**
 * Shape del array `snapshotsBefore` en `ErasureAuditLog`. Cada entrada
 * captura la identidad ANTES del rename — permite rollback manual.
 */
export type ErasureSnapshotBeforeEntry = {
  type: 'POST' | 'COMMENT'
  id: string
  displayName: string
  avatarUrl: string | null
}
