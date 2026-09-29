import type { ProductLine } from './types'

/**
 * Standing disclaimers. Rendered as components (Step 7), not pasted into copy, so that
 * changing the wording once changes it everywhere — including in pages an author
 * forgot about.
 */

/** Required on every product and content page. */
export const FDA_DISCLAIMER =
  'These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, mitigate, or prevent any disease or condition.'

/** Non-dismissible, rendered ABOVE the Add-to-Cart button on Mimosa Hostilis products. */
export const NOT_FOR_HUMAN_CONSUMPTION =
  'Botanical use only. This product is sold exclusively as a raw material for natural dyeing, soap and cosmetic manufacture, and botanical research. It is not food, and it is not for human consumption.'

/** The intended-use attestation text stored verbatim with the order as evidence. */
export const INTENDED_USE_ATTESTATION =
  'I confirm that I am purchasing this botanical material for dyeing, soap or cosmetic manufacture, craft, or research purposes only, and not for human consumption.'

export const AGE_ATTESTATION =
  'I confirm that I am 21 years of age or older and that the person receiving this delivery will be 21 or older.'

/*
  Reworded 2026-09-29 (owner): payment is arranged through the order chat on this
  site, so the site no longer says that no payment happens here. What stays true,
  and is said, is the order of events and that no card details are ever asked for.
*/
export const PAYMENT_ATTESTATION =
  'I understand that a person confirms my order first, then sends payment instructions in my order chat and by email, and that my order is confirmed once payment is received.'

export const PAYMENT_SECURITY_STATEMENT =
  'Payment details reach you in your order chat, and by email, once a person has confirmed your order, and they are only ever for that order. We never ask for card details.'

export function disclaimersFor(lines: readonly ProductLine[]): readonly string[] {
  const out: string[] = [FDA_DISCLAIMER]
  if (lines.includes('MIMOSA_HOSTILIS')) out.unshift(NOT_FOR_HUMAN_CONSUMPTION)
  return out
}
