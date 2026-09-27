import { BRAND } from '@/lib/brand'
import { COMPANY_EMAIL_TOKEN } from '@/lib/site/company-email'
import { absoluteUrl } from '@/lib/seo/routes'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  THE HTML EMAIL SHELL
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Every message this site sends carries a plain-text body — that has not
 * changed, and text stays the version most filters read and every client can
 * render. This adds the HTML alternative beside it.
 *
 * Written to 2003 rules on purpose, because that is what mail clients are:
 *
 *   · Tables for layout. Outlook renders with Word's engine and does not do
 *     flexbox, grid, or float reliably.
 *   · Inline styles on every element. Gmail strips <style> blocks in some
 *     contexts and the entire <head> in others, so nothing structural may live
 *     there.
 *   · No web fonts, no background images, no external CSS. Fonts do not load in
 *     most clients, and images are blocked by default — so the message has to be
 *     complete with every image off.
 *   · Fixed 600px content column. Wider than that and Outlook's preview pane
 *     clips it.
 *   · Colours as literal hex. This is the ONE place in the codebase that is
 *     allowed to hardcode them: an email is rendered by a client that has never
 *     heard of our stylesheet, so a CSS custom property here resolves to
 *     nothing. They are transcribed from the design tokens and named below so
 *     the drift is at least visible.
 *
 * Light palette only. Dark-mode mail clients invert what they choose to and
 * cannot be steered reliably; the safe target is a light message that stays
 * legible if a client inverts it.
 */

/**
 * Transcribed from the LIGHT theme in `src/lib/design/tokens.ts`, and asserted
 * against it by `tests/mail/layout.test.ts` — so a palette change that leaves
 * the emails behind fails the build rather than shipping a stale-looking inbox.
 */
export const INK = '#16181A' // graphite 950 — foreground
const MUTED = '#4E5459' // graphite 600 — foreground-muted
const SUBTLE = '#646B71' // graphite 500 — foreground-subtle
const RULE = '#DFE2E5' // graphite 200 — border
const PAPER = '#FFFFFF' // surface
const SUNKEN = '#F6F7F8' // graphite 50 — surface-sunken
const ACCENT = '#E6D283' // citron 300 — accent

export interface EmailBlock {
  readonly kind: 'heading' | 'paragraph' | 'note' | 'rule'
  readonly text?: string
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * A definition row — "Order number: PSY-000123".
 *
 * Two cells rather than a paragraph so long values wrap under their own label
 * instead of pushing the label off the line.
 */
export function emailRow(label: string, value: string): string {
  return `<tr>
      <td style="padding:6px 0;font:400 13px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${SUBTLE};width:150px;vertical-align:top;">${escapeHtml(label)}</td>
      <td style="padding:6px 0;font:500 14px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${INK};vertical-align:top;">${escapeHtml(value)}</td>
    </tr>`
}

export function emailHeading(text: string): string {
  return `<p style="margin:0 0 8px;font:600 20px/1.3 Georgia,'Times New Roman',serif;color:${INK};">${escapeHtml(text)}</p>`
}

export function emailParagraph(text: string): string {
  return `<p style="margin:0 0 14px;font:400 15px/1.65 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${MUTED};">${escapeHtml(text)}</p>`
}

/** A quoted block — used to echo back what a customer actually wrote. */
export function emailQuote(text: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;"><tr>
      <td style="padding:14px 16px;background:${SUNKEN};border-left:3px solid ${RULE};font:400 14px/1.65 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${INK};white-space:pre-wrap;">${escapeHtml(text)}</td>
    </tr></table>`
}

export function emailButton(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 20px;"><tr>
      <td style="background:${INK};border-radius:6px;">
        <a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 22px;font:600 14px/1 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#FFFFFF;text-decoration:none;">${escapeHtml(label)}</a>
      </td>
    </tr></table>`
}

/**
 * Wrap body HTML in the branded shell.
 *
 * `preheader` is the grey line a client shows next to the subject in the inbox
 * list. Left unset it fills with whatever text comes first, which is usually the
 * logo alt text — so it is always set explicitly, and then hidden in the body.
 */
export function emailShell(args: {
  readonly title: string
  readonly preheader: string
  readonly body: string
  /**
   * Marketing mail only. CAN-SPAM requires a working opt-out and the sender's postal
   * address in every commercial email; transactional mail (receipts, shipping) needs
   * neither and must not offer to "unsubscribe" someone from their own order.
   */
  readonly marketing?: { readonly unsubscribeUrl: string; readonly postalAddress: string }
}): string {
  const year = new Date().getFullYear()
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(args.title)}</title>
</head>
<body style="margin:0;padding:0;background:${SUNKEN};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(args.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${SUNKEN};">
  <tr><td align="center" style="padding:28px 16px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;background:${PAPER};border:1px solid ${RULE};border-radius:12px;">
      <tr><td style="padding:20px 28px;border-bottom:1px solid ${RULE};">
        <!--
          Masthead as a two-cell table, not inline elements: Outlook ignores
          flexbox and treats inline-block unreliably, and a table cell is the one
          alignment primitive every client from Outlook 2007 to Gmail agrees on.

          The image is served at 2x (440px wide) and displayed at 220, so it stays
          sharp on a retina phone. Width and height are set as ATTRIBUTES as well as
          in the style, because Outlook reads the attribute and ignores the style —
          without them a blocked image collapses the row and the layout jumps.

          The alt text is the brand name on purpose. Most clients block remote
          images by default, so for a large share of recipients the alt IS the
          masthead — "logo" or an empty alt would render this header blank.
        -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td align="left" valign="middle">
              <a href="${absoluteUrl('/')}" style="text-decoration:none;">
                <img src="${absoluteUrl('/brand/logo-email.png')}" width="220" height="97" alt="${escapeHtml(BRAND.name)}" style="display:block;border:0;outline:none;text-decoration:none;height:auto;max-width:220px;font:600 19px/1 Georgia,'Times New Roman',serif;color:${INK};">
              </a>
            </td>
            <td align="right" valign="middle" style="white-space:nowrap;">
              <span style="display:inline-block;padding:3px 8px;border-radius:999px;background:${ACCENT};font:600 10px/1.4 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${INK};letter-spacing:0.08em;text-transform:uppercase;">${BRAND.minimumAge}+ &middot; US only</span>
            </td>
          </tr>
        </table>
      </td></tr>
      <tr><td style="padding:26px 28px 6px;">${args.body}</td></tr>
      <tr><td style="padding:18px 28px 24px;border-top:1px solid ${RULE};">
        <p style="margin:0 0 10px;font:400 12px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${SUBTLE};">
          ${escapeHtml(BRAND.legalName)} · <a href="${absoluteUrl('/')}" style="color:${SUBTLE};">${escapeHtml(BRAND.domain)}</a><br>
          Questions: <a href="mailto:${COMPANY_EMAIL_TOKEN}" style="color:${SUBTLE};">${COMPANY_EMAIL_TOKEN}</a>
        </p>
        <p style="margin:0;font:400 11px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${SUBTLE};">
          These statements have not been evaluated by the Food and Drug Administration.
          This product is not intended to diagnose, mitigate, or prevent any disease or condition.
        </p>
        ${
          args.marketing
            ? `<p style="margin:10px 0 0;font:400 11px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${SUBTLE};">
          You are receiving this because you subscribed to ${escapeHtml(BRAND.name)} news.
          <a href="${escapeHtml(args.marketing.unsubscribeUrl)}" style="color:${SUBTLE};">Unsubscribe</a> at any time; it takes one click and never affects an order.<br>
          ${escapeHtml(BRAND.legalName)} · ${escapeHtml(args.marketing.postalAddress)}
        </p>`
            : ''
        }
        <p style="margin:10px 0 0;font:400 11px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${SUBTLE};">&copy; ${year} ${escapeHtml(BRAND.legalName)}</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`
}
