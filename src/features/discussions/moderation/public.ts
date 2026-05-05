/**
 * API pública del sub-slice `discussions/moderation/`.
 *
 * UI de moderación (admin menus). Las actions de hide/unhide/delete viven
 * en posts/ y comments/ — moderation/ sólo monta los menús que las invocan.
 */

export { PostAdminMenu } from './ui/post-admin-menu'
