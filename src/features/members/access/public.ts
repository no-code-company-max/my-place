/**
 * Superficie pública del sub-slice `members/access`.
 *
 * `<OwnersAccessPanel>` — orchestrator del panel `/settings/access`. Es
 * pesado (4 dialogs/sheets internos: ResendInvitationButton, InviteOwnerSheet,
 * LeavePlaceDialog, TransferOwnershipSheet). Por eso se separa del barrel
 * raíz `members/public.ts` (lite): pages que sólo importan `MemberAvatar`
 * o types ya no arrastran este orchestrator.
 *
 * Ver `docs/decisions/2026-05-08-sub-slice-cross-public.md`.
 */

export { OwnersAccessPanel } from '../ui/owners-access-panel'
