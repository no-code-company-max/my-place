import 'server-only'
/** API server-only del sub-slice members/invitations/.
 *  Server Components que consumen queries internas. Client Components
 *  importan sólo de public.ts.
 *
 *  Post-rediseño detail-from-list (2026-05-14): el `PendingInvitationsList`
 *  legacy fue dropeado — la cola de invitaciones pendientes vive ahora
 *  dentro de `<MembersAdminPanel>` (`features/members/admin/`). Si emerge
 *  necesidad de un componente server-only para invitations, sumar acá.
 */
export {}
