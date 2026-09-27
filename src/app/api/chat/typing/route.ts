import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db/client'
import { ensureThread, findThread, visitorId } from '@/lib/chat/core'

/**
 * "Customer is typing…" — plus WHAM's live preview of what they have typed so far,
 * which lets the operator start composing an answer before the question lands.
 *
 * Every call is a database write, and a keystroke handler would make one per key.
 * The client therefore throttles to one call every few seconds while typing, and
 * this endpoint writes nothing at all until the customer has a thread — typing into
 * an empty chat is not yet a conversation worth waking the database for.
 */

const schema = z.object({ text: z.string().max(4000) })

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return new NextResponse(null, { status: 204 })

  const text = parsed.data.text.trim()
  // Minted if missing, as sending does: the page view normally sets it, but not always.
  const visitor = await visitorId(Boolean(text))
  /*
    Someone writing their very first message has no conversation yet: it is created
    when they send. Without one, the owner could not see them typing, and the first
    words of a new customer are exactly the ones worth seeing arrive. So the first
    keystroke opens it. The inbox lists a conversation with no messages only while
    they are typing (api/admin/chat/threads), so one abandoned half-sentence does not
    leave an empty row behind.
  */
  const thread = text && visitor ? await ensureThread({ visitor }) : await findThread(visitor)
  if (!thread) return new NextResponse(null, { status: 204 })

  await db.supportThread.update({
    where: { id: thread.id },
    data: text
      ? { customerTypingAt: new Date(), customerTypingText: text.slice(0, 500) }
      : // An emptied composer clears the indicator immediately rather than leaving a
        // stale "typing…" until it times out.
        { customerTypingAt: null, customerTypingText: null },
  })
  return new NextResponse(null, { status: 204 })
}
