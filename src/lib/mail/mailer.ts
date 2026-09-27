import 'server-only'
import { db } from '@/lib/db/client'
import { reportError } from '@/lib/observability/report-error'
import { fillCompanyEmail } from '@/lib/site/company-email'
import { getCompanyEmail } from '@/lib/site/company-email.server'

/**
 * Transactional email — Brevo.
 *
 * Pluggable, like every other external service in this codebase, so the app runs and
 * is testable before the provider exists. Until `BREVO_API_KEY` and `EMAIL_FROM` are
 * both set, the console provider logs what would have been sent rather than failing.
 *
 * A send failure NEVER throws into a request path. If a customer's order confirmation
 * cannot be delivered, the order still exists and ops has already been notified by
 * ntfy — losing the sale to protect an email would be exactly backwards. Failures are
 * written to NotificationLog so they are visible rather than silent.
 */
export interface EmailMessage {
  readonly to: string
  readonly subject: string
  /** Plain text is required. HTML is optional — some clients and most filters prefer text. */
  readonly text: string
  readonly html?: string
  readonly replyTo?: string
  /**
   * Extra headers. Marketing mail needs List-Unsubscribe and List-Unsubscribe-Post
   * (RFC 8058): Gmail and Yahoo require one-click unsubscribe from bulk senders.
   */
  readonly headers?: Readonly<Record<string, string>>
  /**
   * Files sent with the message: the invoice image on a payment-details email.
   * Brevo takes them base64-encoded in the JSON body, up to 10 MB per message; an
   * invoice PNG is a few hundred KB.
   */
  readonly attachments?: readonly EmailAttachment[]
}

export interface EmailAttachment {
  /** The file name the recipient sees, with its extension: `Invoice 202609-K7Q4M9.png`. */
  readonly name: string
  readonly content: Uint8Array
}

export interface MailProvider {
  readonly name: string
  send(message: EmailMessage): Promise<void>
}

class ConsoleMailProvider implements MailProvider {
  readonly name = 'console'
  async send(message: EmailMessage): Promise<void> {
    console.info(
      `[mail:console] to=${message.to} subject=${JSON.stringify(message.subject)}` +
        (message.attachments?.length
          ? ` attachments=${message.attachments.map((a) => `${a.name}(${a.content.byteLength}B)`).join(',')}`
          : ''),
    )
  }
}

/** Brevo truncates `name` at 70 characters and rejects longer values outright. */
const MAX_SENDER_NAME = 70

interface Sender {
  readonly email: string
  readonly name?: string
}

/**
 * `EMAIL_FROM` is written in the RFC 5322 form every other provider accepts —
 * `Snypegate <sales@snypegate.com>` — but Brevo wants the two halves as separate JSON
 * fields. Parsing here keeps the env var in the format a human recognises instead of
 * forcing two variables that can drift apart.
 *
 * A bare address with no display name is accepted and sends without one.
 */
export function parseSender(value: string): Sender | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined

  const angled = /^(.*?)\s*<([^>]+)>$/.exec(trimmed)
  const email = (angled?.[2] ?? trimmed).trim()
  if (!email.includes('@')) return undefined

  const name = angled?.[1]?.trim().replace(/^"|"$/g, '').slice(0, MAX_SENDER_NAME)
  return name ? { email, name } : { email }
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}

/**
 * Brevo requires `htmlContent` whenever no `templateId` is given — a text-only send is
 * rejected outright, which `EmailMessage.html` being optional does not prevent. Every
 * template in templates.ts supplies its own HTML, so this is the safety net for a caller
 * that does not: it wraps the plain text rather than letting the send fail with a 400
 * that reads like a credentials problem.
 */
function htmlFromText(text: string): string {
  const escaped = text.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c] ?? c)
  const paragraphs = escaped
    .split(/\n{2,}/)
    .map((block) => `<p>${block.replace(/\n/g, '<br />')}</p>`)
    .join('\n')
  return `<div style="font-family:system-ui,-apple-system,sans-serif;font-size:15px;line-height:1.6">${paragraphs}</div>`
}

class BrevoMailProvider implements MailProvider {
  readonly name = 'brevo'
  constructor(
    private readonly apiKey: string,
    private readonly sender: Sender,
  ) {}

  async send(message: EmailMessage): Promise<void> {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        // Brevo authenticates on its own `api-key` header, NOT `Authorization: Bearer`.
        'api-key': this.apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        sender: this.sender,
        to: [{ email: message.to }],
        subject: message.subject,
        textContent: message.text,
        htmlContent: message.html ?? htmlFromText(message.text),
        ...(message.replyTo ? { replyTo: { email: message.replyTo } } : {}),
        ...(message.headers ? { headers: message.headers } : {}),
        ...(message.attachments?.length
          ? {
              attachment: message.attachments.map((a) => ({
                name: a.name,
                content: Buffer.from(a.content).toString('base64'),
              })),
            }
          : {}),
      }),
      // Never hold a checkout response open on a slow mail API.
      signal: AbortSignal.timeout(8000),
    })
    // 201 on send, 202 when scheduled. `ok` covers both.
    if (!response.ok) {
      throw new Error(`Brevo responded ${response.status}: ${await response.text()}`)
    }
  }
}

/**
 * Templates write COMPANY_EMAIL_TOKEN wherever the company's address goes — the
 * recipient of an enquiry, a reply-to, the footer of every message. It is filled in
 * here, at the last moment, with the address set in the admin, so no email can go out
 * with an address that was changed after the template was written.
 */
export async function resolveCompanyEmail(message: EmailMessage): Promise<EmailMessage> {
  return fillCompanyEmail(message, await getCompanyEmail())
}

/**
 * Every real provider is wrapped in this, so the token is resolved whichever way a
 * message is sent — through `sendEmail`, or by a caller holding the provider directly
 * (the contact and bulk forms do).
 */
class CompanyEmailResolvingProvider implements MailProvider {
  constructor(private readonly inner: MailProvider) {}
  get name(): string {
    return this.inner.name
  }
  async send(message: EmailMessage): Promise<void> {
    await this.inner.send(await resolveCompanyEmail(message))
  }
}

let provider: MailProvider | undefined

export function getMailProvider(): MailProvider {
  if (provider) return provider
  const apiKey = process.env.BREVO_API_KEY?.trim()
  const sender = parseSender(process.env.EMAIL_FROM ?? '')
  provider = new CompanyEmailResolvingProvider(
    apiKey && sender ? new BrevoMailProvider(apiKey, sender) : new ConsoleMailProvider(),
  )
  return provider
}

export function setMailProvider(next: MailProvider): void {
  provider = next
}

/** Test seam. `getMailProvider` memoises, which would pin the first env it saw. */
export function resetMailProvider(): void {
  provider = undefined
}

export async function sendEmail(unresolved: EmailMessage): Promise<boolean> {
  const active = getMailProvider()
  // Resolved here as well, so the log records the address the mail actually went to.
  const message = await resolveCompanyEmail(unresolved)
  try {
    await active.send(message)
    await logSend(active.name, message, true)
    return true
  } catch (error) {
    // A customer who ordered and heard nothing is the exact failure this whole
    // pipeline exists to surface. Swallowing it protects checkout; reporting it
    // means someone finds out the same minute rather than from a complaint.
    await reportError(error, {
      source: 'mail',
      severity: 'FATAL',
      context: { provider: active.name, subject: message.subject, to: message.to },
    })
    await logSend(active.name, message, false, (error as Error).message)
    return false
  }
}

async function logSend(
  channel: string,
  message: EmailMessage,
  success: boolean,
  error?: string,
): Promise<void> {
  try {
    await db.notificationLog.create({
      data: {
        channel: `EMAIL:${channel}`,
        subject: message.subject,
        target: message.to,
        success,
        ...(error ? { error } : {}),
      },
    })
  } catch {
    // Logging the failure must not itself become a failure path.
  }
}
