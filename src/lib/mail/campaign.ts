import { BRAND } from '@/lib/brand'
import { scanText, type ScanResult } from '@/lib/compliance/lexicon'
import type { ProductLine } from '@/lib/compliance/types'
import { absoluteUrl } from '@/lib/seo/routes'
import { emailButton, emailParagraph, emailShell } from './layout'
import type { EmailMessage } from './mailer'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  EMAIL BLASTS — what one looks like, and whether it may go out. Pure.
 *
 *  The body is plain text: paragraphs separated by a blank line. A line that is
 *  only `[Label](/path)` becomes a button. Buttons link to THIS site and nowhere
 *  else: a blast is the one surface where an operator writes to the whole list at
 *  once, and "a link to anywhere" is how a stolen admin login phishes every
 *  subscriber in a single send.
 *
 *  The copy meets the compliance lexicon like every other surface (CLAUDE.md
 *  rule 4): every product line, and `honourDirectives: false`, so nothing typed
 *  into the form can switch the scan off.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const ALL_LINES: readonly ProductLine[] = ['MIMOSA_HOSTILIS', 'AMANITA', 'VAPE']

export const LIMITS = { name: 100, subject: 150, body: 10_000, buttons: 3 } as const

export type Block =
  | { readonly kind: 'paragraph'; readonly text: string }
  | { readonly kind: 'button'; readonly label: string; readonly href: string }

const BUTTON = /^\[([^\]\n]{1,60})\]\((\/[^\s)]*)\)$/
// Greedy: a target with its own parentheses — javascript:alert(1) — is still a link attempt.
const ANY_LINK = /^\[[^\]\n]*\]\((.*)\)$/s

export function parseBody(body: string): { blocks: Block[]; problems: string[] } {
  const blocks: Block[] = []
  const problems: string[] = []
  const chunks = body.replace(/\r\n?/g, '\n').split(/\n\s*\n/)
  for (const chunk of chunks) {
    const text = chunk.trim()
    if (!text) continue
    const button = BUTTON.exec(text)
    if (button) {
      // `//evil.com` starts with a slash too, and is another site.
      if (button[2]!.startsWith('//')) {
        problems.push(`Buttons can only link to a page on this site: ${button[2]}`)
        continue
      }
      blocks.push({ kind: 'button', label: button[1]!.trim(), href: absoluteUrl(button[2]!) })
      continue
    }
    const link = ANY_LINK.exec(text)
    if (link) {
      problems.push(`Buttons can only link to a page on this site, written as a path like /shop: ${link[1]}`)
      continue
    }
    blocks.push({ kind: 'paragraph', text: text.replace(/\s*\n\s*/g, ' ') })
  }
  const buttons = blocks.filter((b) => b.kind === 'button').length
  if (buttons > LIMITS.buttons) problems.push(`At most ${LIMITS.buttons} buttons; this has ${buttons}.`)
  if (!blocks.some((b) => b.kind === 'paragraph')) problems.push('Write at least one paragraph.')
  return { blocks, problems }
}

export interface CampaignForm {
  readonly name: string
  readonly subject: string
  readonly body: string
}

export function readCampaignForm(
  formData: FormData,
): { ok: true; value: CampaignForm } | { ok: false; error: string } {
  const field = (key: string) => String(formData.get(key) ?? '').trim()
  const value = { name: field('name'), subject: field('subject'), body: field('body') }
  if (!value.name) return { ok: false, error: 'Give the blast a name, for your own list.' }
  if (!value.subject) return { ok: false, error: 'Write a subject line.' }
  if (!value.body) return { ok: false, error: 'Write the message.' }
  if (value.name.length > LIMITS.name) return { ok: false, error: `Keep the name under ${LIMITS.name} characters.` }
  if (value.subject.length > LIMITS.subject) {
    return { ok: false, error: `Keep the subject under ${LIMITS.subject} characters.` }
  }
  if (value.body.length > LIMITS.body) {
    return { ok: false, error: `Keep the message under ${LIMITS.body.toLocaleString('en-US')} characters.` }
  }
  return { ok: true, value }
}

export function scanCampaign(subject: string, body: string): ScanResult {
  return scanText(`${subject}\n\n${body}`, { productLines: ALL_LINES, honourDirectives: false })
}

export interface ReadinessInput {
  readonly subject: string
  readonly body: string
  readonly postalAddress: string
  readonly mailConfigured: boolean
  readonly recipients: number
}

/**
 * Everything that must be true before a blast reaches a single subscriber, as
 * plain sentences. Empty means it may send. A test to the operator skips the
 * recipient and address checks: it goes to one person who asked for it.
 */
export function sendProblems(input: ReadinessInput, { test = false }: { test?: boolean } = {}): string[] {
  const problems: string[] = []
  const scan = scanCampaign(input.subject, input.body)
  for (const match of scan.blocking) {
    problems.push(`“${match.term}” cannot be used: ${match.reason}`)
  }
  problems.push(...parseBody(input.body).problems)
  if (!input.mailConfigured) {
    problems.push('Email is not set up: BREVO_API_KEY and EMAIL_FROM are needed, or nothing is actually sent.')
  }
  if (!test) {
    if (!input.postalAddress.trim()) {
      problems.push(
        'Add the business postal address in Admin → Settings. US law (CAN-SPAM) requires it in every marketing email.',
      )
    }
    if (input.recipients === 0) problems.push('There is no one left to send it to.')
  }
  return problems
}

export interface CampaignEmailInput {
  readonly to: string
  readonly subject: string
  readonly body: string
  readonly unsubscribe: { readonly page: string; readonly oneClick: string }
  readonly postalAddress: string
  /** The business's contact address: replies go here, and it is the mailto opt-out. */
  readonly contactEmail: string
  readonly test?: boolean
}

export function campaignEmail(input: CampaignEmailInput): EmailMessage {
  const { blocks } = parseBody(input.body)
  const subject = input.test ? `[Test] ${input.subject}` : input.subject
  const firstParagraph = blocks.find((b) => b.kind === 'paragraph')
  const preheader = firstParagraph?.kind === 'paragraph' ? firstParagraph.text.slice(0, 110) : input.subject
  const address = input.postalAddress.trim() || '(postal address not yet set)'

  const html = emailShell({
    title: subject,
    preheader,
    body: blocks
      .map((b) => (b.kind === 'paragraph' ? emailParagraph(b.text) : emailButton(b.label, b.href)))
      .join('\n'),
    marketing: { unsubscribeUrl: input.unsubscribe.page, postalAddress: address },
  })

  const text = [
    ...blocks.map((b) => (b.kind === 'paragraph' ? b.text : `${b.label}: ${b.href}`)),
    '—',
    `You are receiving this because you subscribed to ${BRAND.name} news. Unsubscribe at any time: ${input.unsubscribe.page}`,
    `${BRAND.legalName} · ${address}`,
    'These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, mitigate, or prevent any disease or condition.',
  ].join('\n\n')

  return {
    to: input.to,
    subject,
    text,
    html,
    replyTo: input.contactEmail,
    headers: {
      'List-Unsubscribe': `<${input.unsubscribe.oneClick}>, <mailto:${input.contactEmail}?subject=unsubscribe>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  }
}
