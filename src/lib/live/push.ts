import 'server-only'
import { createHmac } from 'node:crypto'
import { after } from 'next/server'
import { headerSafe } from '@/lib/notify/ntfy'
import { LIVE_PUSH_ORIGIN } from './config'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  LIVE CHAT PINGS — push instead of polling, so the database can sleep.
 *
 *  Neon bills every hour the database is awake and only suspends after five minutes
 *  with ZERO queries. A chat that polls every few seconds "in case" holds it awake
 *  for as long as anybody has a tab open. So instead, whenever something changes that
 *  the other side should see, the server publishes a tiny ping to ntfy.sh, and the
 *  browser — which holds one EventSource to ntfy.sh, not to us — polls once when it
 *  arrives. Between pings nothing touches Vercel or Neon at all.
 *
 *  ── The ping says nothing ─────────────────────────────────────────────────────
 *  The body is the single word "sync": no message text, no name, no thread id. The
 *  browser always fetches the real content from our own endpoint, which checks who
 *  is asking. ntfy keeps it in its short cache (so a browser reconnecting can replay
 *  a ping it missed by seconds) and is told not to forward it to Firebase.
 *
 *  ── The topic is unguessable, and costs no column ────────────────────────────
 *  ntfy.sh topics are public to anyone who knows the name, so the name is the
 *  secret: an HMAC-SHA256 of the thread id under ADMIN_SESSION_SECRET (the key every
 *  other signed link here already derives from), 160 bits as hex. Derived on demand,
 *  so nothing is stored. Knowing a topic tells you only WHEN a thread changed, never
 *  what it says. Rotating the secret simply moves every topic; browsers learn the
 *  new name on their next poll.
 *
 *  ── Fire-and-forget ──────────────────────────────────────────────────────────
 *  Published from `after()`, once the response has gone, with every failure
 *  swallowed: a ping that does not arrive costs a few seconds of latency until the
 *  browser's own safety poll, never a failed reply. Outside a request (a script,
 *  a unit test) there is nobody waiting on a ping, and none is sent.
 *
 *  Uses the owner's NTFY_TOKEN when set, so pings count against the ntfy account
 *  rather than a Vercel egress address shared with strangers.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const THREAD_PREFIX = 'mlc-'
const STAFF_PREFIX = 'mls-'
/** 40 hex characters = 160 bits. ntfy allows up to 64 characters in a topic name. */
const TOPIC_HEX = 40
const PUBLISH_TIMEOUT_MS = 4000

function pushSecret(): string | null {
  const secret = process.env.ADMIN_SESSION_SECRET
  return secret && secret.length >= 32 ? secret : null
}

function derive(prefix: string, label: string, secret: string): string {
  return prefix + createHmac('sha256', secret).update(label).digest('hex').slice(0, TOPIC_HEX)
}

/** The ntfy topic a customer's browser listens on for its own thread. Null when unconfigured. */
export function threadTopic(threadId: string, secret: string | null = pushSecret()): string | null {
  if (!secret || !threadId) return null
  return derive(THREAD_PREFIX, `chat-thread:v1:${threadId}`, secret)
}

/** The one topic the admin inbox listens on: any customer activity worth a fresh look. */
export function staffTopic(secret: string | null = pushSecret()): string | null {
  if (!secret) return null
  return derive(STAFF_PREFIX, 'chat-staff:v1', secret)
}

/** Publish one content-free ping. Never throws. Exported for tests. */
export async function publishPing(topic: string): Promise<void> {
  const headers: Record<string, string> = {
    'Content-Type': 'text/plain',
    // Never relayed to Firebase/Apple: it is a doorbell for an open page, not a phone alert.
    Firebase: 'no',
  }
  if (process.env.NTFY_TOKEN) headers.Authorization = headerSafe(`Bearer ${process.env.NTFY_TOKEN}`)
  try {
    await fetch(`${LIVE_PUSH_ORIGIN}/${topic}`, {
      method: 'POST',
      headers,
      body: 'sync',
      signal: AbortSignal.timeout(PUBLISH_TIMEOUT_MS),
    })
  } catch {
    // Ignored by design: the browser's safety poll catches up.
  }
}

function schedule(topics: readonly (string | null)[]): void {
  const live = [...new Set(topics.filter((t): t is string => Boolean(t)))]
  if (live.length === 0) return
  try {
    after(() => Promise.all(live.map(publishPing)))
  } catch {
    // Called outside a request scope: nobody is listening for this one.
  }
}

/** The shop said, changed or removed something in these threads: tell the customers' browsers. */
export function pingThreads(threadIds: readonly string[]): void {
  const secret = pushSecret()
  // A bulk delete of a hundred threads must not be a hundred-request burst.
  schedule(threadIds.slice(0, 25).map((id) => threadTopic(id, secret)))
}

export function pingThread(threadId: string): void {
  pingThreads([threadId])
}

/** A customer wrote, started typing or read a reply: tell the admin inbox. */
export function pingStaff(): void {
  schedule([staffTopic()])
}
