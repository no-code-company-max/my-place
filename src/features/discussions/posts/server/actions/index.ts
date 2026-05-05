/**
 * Re-exports públicos de los server actions sobre Post. El split por operación
 * (create/edit/moderate/delete) respeta el cap de 300 líneas por archivo del
 * proyecto. Consumers importan desde `./posts` y el resolver apunta a este
 * `index.ts`.
 */

export { createPostAction } from './create'
export { editPostAction, openPostEditSession } from './edit'
export { hidePostAction, unhidePostAction } from './moderate'
export { deletePostAction } from './delete'
