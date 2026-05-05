/**
 * Tipos del job de erasure 365d (C.L). Privados al sub-slice
 * `features/members/server/erasure/`.
 */

export type ErasureRunResult = {
  dryRun: boolean
  membershipsProcessed: number
  postsAnonymized: number
  commentsAnonymized: number
  /**
   * Cantidad de eventos cuyo `authorUserId` fue nullificado + `authorSnapshot.displayName`
   * renombrado a "ex-miembro". F.C Fase 6 (PR-3) — ver
   * `docs/features/events/spec-integrations.md § 3`.
   */
  eventsAnonymized: number
  /**
   * Cantidad de RSVPs DELETEadas del ex-miembro **sólo en el place que dejó**
   * (no global). Si el user sigue activo en otros places, sus RSVPs allá se
   * preservan. F.C Fase 6 (PR-3).
   */
  rsvpsDeleted: number
  /**
   * Cantidad de `LibraryItem` cuyo `authorUserId` fue nullificado +
   * `authorSnapshot.displayName` renombrado a "ex-miembro". Erasure coverage
   * extension (2026-05-01) — mismo patrón Post/Comment/Event.
   */
  libraryItemsAnonymized: number
  /**
   * Cantidad de filas `LibraryCategoryContributor` DELETEadas del ex-miembro
   * en categorías del place. Es permission, no historia.
   */
  libraryContributorsRemoved: number
  /**
   * Cantidad de filas `PostRead` DELETEadas del ex-miembro en posts del
   * place. Tracking de lectura sin valor histórico.
   */
  postReadsRemoved: number
  /**
   * Cantidad de `Flag` donde el ex-miembro era reporter, con `reporterUserId`
   * nullificado + `reporterSnapshot.displayName` renombrado a "ex-miembro".
   */
  flagsAsReporterAnonymized: number
  /**
   * Cantidad de `Flag` donde el ex-miembro era reviewer admin, con
   * `reviewerAdminUserId` nullificado (sin snapshot — no existe para reviewer).
   */
  flagsAsReviewerAnonymized: number
  errorsPerMembership: Array<{ membershipId: string; error: string }>
}

export type ErasureMembershipCounts = {
  posts: number
  comments: number
  events: number
  rsvpsDeleted: number
  libraryItemsAnonymized: number
  libraryContributorsRemoved: number
  postReadsRemoved: number
  flagsAsReporterAnonymized: number
  flagsAsReviewerAnonymized: number
}

/**
 * Shape del array `snapshotsBefore` en `ErasureAuditLog`. Cada entrada
 * captura la identidad ANTES del rename — permite rollback manual.
 */
export type ErasureSnapshotBeforeEntry = {
  type: 'POST' | 'COMMENT' | 'EVENT' | 'LIBRARY_ITEM' | 'FLAG_REPORTER'
  id: string
  displayName: string
  avatarUrl: string | null
}
