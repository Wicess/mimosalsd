/**
 * Links inside a chat message (owner, 2026-11-23: "when I paste a link in the chat it
 * should be clickable", above all a Cash App payment link).
 *
 * Splits a message into text and link parts. Recognised: anything starting
 * `http://` or `https://`, anything starting `www.`, and a bare `cash.app/…`, the
 * form a Cash App link is usually pasted in. A link always opens over https unless it
 * was written with http, and nothing but http(s) can come out of this, so a
 * `javascript:` or `data:` "link" stays plain text.
 *
 * Deliberately NOT a bare `$Cashtag`: the payment instructions themselves say "a typo
 * in the $Cashtag", which would turn into a link to a stranger's Cash App.
 */

export type MessagePart = { readonly kind: 'text'; readonly text: string } | { readonly kind: 'link'; readonly text: string; readonly href: string }

const LINK = /\b(?:https?:\/\/|www\.|cash\.app\/)[^\s<>"]+/gi

/** Punctuation that ends a sentence rather than the link: "pay at cash.app/$Shop." */
const TRAILING = /[.,;:!?'"’”]+$/

function trimTrailing(raw: string): string {
  let out = raw.replace(TRAILING, '')
  // A closing bracket belongs to the link only if the link opened one: "(see https://x.com/a)".
  while (out.endsWith(')') && (out.match(/\(/g)?.length ?? 0) < (out.match(/\)/g)?.length ?? 0)) {
    out = out.slice(0, -1).replace(TRAILING, '')
  }
  return out
}

export function splitLinks(body: string): MessagePart[] {
  const parts: MessagePart[] = []
  let last = 0
  for (const match of body.matchAll(LINK)) {
    const start = match.index ?? 0
    const text = trimTrailing(match[0])
    if (!text || /^(?:https?:\/\/|www\.|cash\.app\/)$/i.test(text)) continue
    if (start > last) parts.push({ kind: 'text', text: body.slice(last, start) })
    const href = /^https?:\/\//i.test(text) ? text : `https://${text}`
    parts.push({ kind: 'link', text, href })
    last = start + text.length
  }
  if (last < body.length) parts.push({ kind: 'text', text: body.slice(last) })
  return parts
}
