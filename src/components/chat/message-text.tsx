import { Fragment } from 'react'
import { splitLinks } from '@/lib/chat/links'

/**
 * A chat message's text with its links made clickable (lib/chat/links.ts).
 *
 * Links open in a new tab, so the conversation stays where it was, with `noopener`
 * and `noreferrer` so the page opened cannot reach back into this one, and
 * `nofollow` because a link in a customer's message is not one we vouch for.
 * Underlined and inheriting the bubble's colour, so a link reads as a link on the
 * green customer bubble and on the plain shop bubble alike.
 */
export function MessageText({ body }: { body: string }) {
  return (
    <>
      {splitLinks(body).map((part, i) =>
        part.kind === 'link' ? (
          <a
            key={i}
            href={part.href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="font-medium break-all underline underline-offset-2 hover:decoration-2"
          >
            {part.text}
          </a>
        ) : (
          <Fragment key={i}>{part.text}</Fragment>
        ),
      )}
    </>
  )
}
