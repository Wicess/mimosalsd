import 'server-only'

/**
 * ntfy — operational notifications.
 *
 * Ops must learn about a new order in seconds, because the entire fulfilment model
 * depends on a human verifying payment. A missed notification is a customer who paid
 * and heard nothing.
 *
 * Failures are logged and swallowed. A notification outage must never fail a customer's
 * checkout — the order is already persisted by the time we get here, and losing the
 * sale to protect a push message would be exactly backwards.
 *
 * ── EVERY PUSH IS MAXIMUM PRIORITY ────────────────────────────────────────────
 * The owner's instruction: an alert must vibrate and keep alarming until it is
 * tapped. ntfy's priority 5 ("urgent") is the one that does that — long vibration
 * bursts, the notification sound and a pop-over — and it is the ONLY level the
 * Android app will repeat: with "Keep alerting for highest priority" switched on
 * (ntfy app → Settings → Notifications), a priority-5 message "continuously alerts
 * until dismissed". No publish header can make a message repeat on its own; the
 * repeating is the phone's, so the server's whole job is to send priority 5, always.
 * Hence no per-call priority: there is no alert in this business that is allowed to
 * be missed quietly.
 */
export type NtfyTopic =
  | 'orders-new'
  | 'orders-paid'
  | 'signups'
  | 'stock-low'
  | 'chat-inbound'
  | 'errors'

/*
  ── TWO PHONE TOPICS, SPLIT THE WAY THE OWNER ASKED (2026-09-13) ─────────────────
  NTFY_TOPIC_ALERTS is the CHAT topic: conversations a person has to answer — live
  chat, the contact form and the bulk-quote form, which all land in the one inbox.

  NTFY_TOPIC_ORDERS carries everything else: new orders, payment claims, proofs and
  confirmations, newsletter sign-ups, and the operational alarms — site errors,
  failed admin sign-ins and state-rule changes. The owner moved those alarms off the
  chat topic so a ringing chat topic always means a customer is waiting.

  The env names predate the split and are kept, because renaming them would silence
  every push until the production environment was edited to match.
*/
export const TOPIC_ENV: Record<NtfyTopic, 'NTFY_TOPIC_ORDERS' | 'NTFY_TOPIC_ALERTS'> = {
  'orders-new': 'NTFY_TOPIC_ORDERS',
  'orders-paid': 'NTFY_TOPIC_ORDERS',
  signups: 'NTFY_TOPIC_ORDERS',
  'stock-low': 'NTFY_TOPIC_ORDERS',
  errors: 'NTFY_TOPIC_ORDERS',
  'chat-inbound': 'NTFY_TOPIC_ALERTS',
}

export interface NtfyMessage {
  readonly topic: NtfyTopic
  readonly title: string
  readonly body: string
  readonly tags?: readonly string[]
  readonly clickUrl?: string
}

/**
 * ntfy carries the title in an HTTP HEADER, and `fetch` requires header values to be
 * a ByteString — every character must fit in a single byte.
 *
 * This is not theoretical. It was found by the error reporter on its very first live
 * push, whose title contained an em-dash: `fetch` threw "Cannot convert argument to a
 * ByteString because the character at index 16 has a value of 8212", the whole
 * notification was lost, and the failure surfaced only because something was watching.
 * Any order alert quoting a product name with a curly apostrophe or an en-dash would
 * have died the same silent way.
 *
 * Latin-1 (up to 0xFF) passes through untouched, so accented names are kept. Only the
 * typographic characters above it are folded, and the full untouched text is in the
 * body — which is a request body, not a header, and therefore UTF-8 safe.
 */
const TYPOGRAPHIC: Record<string, string> = {
  '\u2014': '-', '\u2013': '-', '\u2018': "'", '\u2019': "'",
  '\u201c': '"', '\u201d': '"', '\u2026': '...', '\u00d7': 'x',
}

export function headerSafe(value: string): string {
  let folded = ''
  for (const char of value) {
    if (char.charCodeAt(0) <= 0xff) {
      folded += char
      continue
    }
    folded += TYPOGRAPHIC[char] ?? '?'
  }
  return folded
}

export async function notify(message: NtfyMessage): Promise<boolean> {
  const base = process.env.NTFY_URL
  const topic = process.env[TOPIC_ENV[message.topic]]
  if (!base || !topic) {
    // Not configured yet — log so it is visible in development rather than silent.
    console.info(`[ntfy:not-configured] ${message.title} — ${message.body}`)
    return false
  }

  try {
    const headers: Record<string, string> = {
      Title: headerSafe(message.title),
      Priority: 'urgent',
    }
    if (message.tags?.length) headers.Tags = headerSafe(message.tags.join(','))
    if (message.clickUrl) headers.Click = headerSafe(message.clickUrl)
    if (process.env.NTFY_TOKEN) {
      headers.Authorization = `Bearer ${process.env.NTFY_TOKEN}`
    }

    const response = await fetch(`${base.replace(/\/$/, '')}/${topic}`, {
      method: 'POST',
      headers,
      body: message.body,
      // Never let a slow notification hold a checkout response open.
      signal: AbortSignal.timeout(4000),
    })
    return response.ok
  } catch (error) {
    // Imported lazily on purpose. report-error.ts imports THIS module to send its
    // pushes, so a static import here is a cycle — and a cycle whose evaluation order
    // decides whether `notify` is defined when the reporter first calls it.
    const { reportError } = await import('@/lib/observability/report-error')
    // `push: false` — this IS the notifier. Alerting about it through itself would
    // either fail identically or loop. It still lands in the admin error log.
    await reportError(error, {
      source: 'ntfy',
      severity: 'ERROR',
      push: false,
      context: { topic: message.topic, title: message.title },
    })
    return false
  }
}
