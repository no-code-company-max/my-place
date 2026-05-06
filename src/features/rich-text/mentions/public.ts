/**
 * Superficie pública del sub-slice `rich-text/mentions`.
 *
 * Concentra el `MentionNode` (DecoratorNode polimórfico) + el plugin de
 * typeahead con los 3 triggers (`@`, `/event`, `/library`). Lo consumen los
 * composers (`composers/`) y el renderer (`renderer/`) del slice rich-text.
 *
 * Patrón heredado de `embeds/` (mismo cap 1500 LOC, ver
 * `docs/decisions/2026-04-21-flags-subslice-split.md`).
 */

export { MentionNode, $createMentionNode, $isMentionNode } from './ui/mention-node'
export type { MentionKind, MentionPayload } from './ui/mention-node'

export { MentionPlugin } from './ui/mention-plugin'
export type {
  ComposerMentionResolvers,
  MentionEventResult,
  MentionLibraryCategoryResult,
  MentionLibraryItemResult,
  MentionResolversForEditor,
  MentionUserResult,
} from './ui/mention-plugin'
