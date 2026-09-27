import { BRAND } from '@/lib/brand'

/**
 * The first thing the shop says in a new conversation.
 *
 * WHAM's greeting advertises discounts. This one advertises nothing it cannot prove,
 * per the rule in ~/.claude/CLAUDE.md that generated copy must never claim what the
 * data does not support — and copy written once is not re-read when the facts behind
 * it change. So: no response-time promise (the operator may be asleep), no price or
 * discount (those move), and no statement about any product's effects (rule 4).
 *
 * What it does do is ask for the two facts that decide whether an order can happen
 * at all — which product, and which state — so the first human reply can be useful
 * rather than a question.
 */
export const WELCOME_MESSAGE =
  `Welcome to ${BRAND.name}. Tell us which product you are looking at and which ` +
  'state you are shipping to — availability depends on the state, and that is ' +
  'usually the first thing to check.\n\n' +
  'A person reads every message here. You can send a photo or a PDF in this chat too.'
