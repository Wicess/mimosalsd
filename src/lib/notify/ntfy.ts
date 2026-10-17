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

/** A button on the notification. Tapping it opens `url` (ntfy's "view" action). */
export interface NtfyAction {
  readonly label: string
  readonly url: string
}

export interface NtfyMessage {
  readonly topic: NtfyTopic
  readonly title: string
  readonly body: string
  /**
   * ntfy tags. A tag that is an emoji short code (`shopping_cart`, `camera`) shows as
   * the notification's icon, in front of the title; anything else shows as a label.
   * Put the emoji first: it is how the owner tells an order from a chat at a glance.
   */
  readonly tags?: readonly string[]
  /** Where tapping the notification itself goes: always the admin page it is about. */
  readonly clickUrl?: string
  /** Up to three buttons. ntfy shows them under the text. */
  readonly actions?: readonly NtfyAction[]
  /** An image the phone shows inside the notification, e.g. the photo a customer sent. */
  readonly attach?: { readonly url: string; readonly filename: string }
}

/**
 * The body as labelled lines, the shape every alert uses: the facts the owner needs
 * to decide whether to act now, one per line, and a line left out when it is empty.
 */
export function alertLines(lines: readonly (readonly [label: string, value: string | null | undefined | false])[]): string {
  return lines
    .filter(([, value]) => typeof value === 'string' && value.trim() !== '')
    .map(([label, value]) => (label ? `${label}: ${value}` : String(value)))
    .join('\n')
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

/** The app icon, shown beside every alert, so a MIMOSALSD alert never looks like another app's. */
function iconUrl(): string | undefined {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '')
  return site ? `${site}/brand/app-icon-v2-192.png` : undefined
}

/** ntfy's published limit for a message body; longer is cut, never refused. */
const MAX_BODY = 3800
const ATTEMPTS = 3
const ATTEMPT_TIMEOUT_MS = 6000

/**
 * Publish one alert.
 *
 * Sent as JSON to the server root rather than as headers to the topic URL: a JSON body
 * is UTF-8, so titles keep their dashes, accents and emoji, and it is the only form
 * that carries action buttons and an attached image. `headerSafe` is kept for the one
 * thing that is still a header, the token.
 *
 * Retried. ntfy.sh timed out on 2026-10-08 and the alert was lost; an order or a
 * customer's photo is worth a second and third try. Callers that sit in front of a
 * customer (checkout) send it from `after()`, so the retries never hold a page open.
 */
export async function notify(message: NtfyMessage): Promise<boolean> {
  const base = process.env.NTFY_URL
  const topic = process.env[TOPIC_ENV[message.topic]]
  if (!base || !topic) {
    // Not configured yet — log so it is visible in development rather than silent.
    console.info(`[ntfy:not-configured] ${message.title} — ${message.body}`)
    return false
  }

  const icon = iconUrl()
  const payload = {
    topic,
    title: message.title,
    message: message.body.length > MAX_BODY ? `${message.body.slice(0, MAX_BODY)}…` : message.body,
    priority: 5,
    ...(message.tags?.length ? { tags: [...message.tags] } : {}),
    ...(message.clickUrl ? { click: message.clickUrl } : {}),
    ...(message.actions?.length
      ? { actions: message.actions.slice(0, 3).map((a) => ({ action: 'view', label: a.label, url: a.url, clear: true })) }
      : {}),
    ...(message.attach ? { attach: message.attach.url, filename: message.attach.filename } : {}),
    ...(icon ? { icon } : {}),
  }
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (process.env.NTFY_TOKEN) headers.Authorization = headerSafe(`Bearer ${process.env.NTFY_TOKEN}`)

  let lastError: unknown = null
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(base.replace(/\/$/, ''), {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
      })
      if (response.ok) return true
      // A 4xx will not improve on a retry: a bad token, a reserved topic, a malformed field.
      lastError = new Error(`ntfy answered HTTP ${response.status}`)
      if (response.status < 500 && response.status !== 429) break
    } catch (error) {
      lastError = error
    }
    if (attempt < ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, 400 * attempt))
  }

  // Imported lazily on purpose. report-error.ts imports THIS module to send its
  // pushes, so a static import here is a cycle — and a cycle whose evaluation order
  // decides whether `notify` is defined when the reporter first calls it.
  const { reportError } = await import('@/lib/observability/report-error')
  // `push: false` — this IS the notifier. Alerting about it through itself would
  // either fail identically or loop. It still lands in the admin error log.
  await reportError(lastError, {
    source: 'ntfy',
    severity: 'ERROR',
    push: false,
    context: { topic: message.topic, title: message.title },
  })
  return false
}
