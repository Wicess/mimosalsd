/**
 * Grouping and redaction for error reports.
 *
 * Pure, and separate from the reporter, because these two decisions are the ones that
 * make an error log usable or useless and they must be testable without a database:
 *
 *  · GROUPING — a bug that fires on every request must be ONE row, or the table meant
 *    to tell you what broke becomes the thing filling the database. Two reports group
 *    together when they share a source, an error name, and a message whose variable
 *    parts have been stripped.
 *
 *  · REDACTION — an error message is the most common way a secret escapes into
 *    storage. A failed fetch stringifies its headers; a Prisma error quotes the row it
 *    choked on. This table is readable by any STAFF user with the errors area, so it
 *    is redacted on the way IN, not on the way out.
 */

/** Longer than this and it is a stack trace wearing a message's clothes. */
export const MAX_MESSAGE = 2000
export const MAX_STACK = 8000

const REDACTED = '[redacted]'

const REDACTIONS: readonly (readonly [RegExp, string])[] = [
  // Provider keys, in the shapes this project actually holds.
  [/xkeysib-[A-Za-z0-9-]{16,}/g, `xkeysib-${REDACTED}`],
  [/\bnpg_[A-Za-z0-9]{8,}/g, `npg_${REDACTED}`],
  // postgres://user:password@host — the password, not the whole URL, which is useful.
  [/(postgres(?:ql)?:\/\/[^:/\s]+:)[^@\s]+@/gi, `$1${REDACTED}@`],
  // Authorization: Bearer …, api-key: …, and JSON "token": "…" style fields.
  [/(bearer\s+)[A-Za-z0-9._~+/=-]{12,}/gi, `$1${REDACTED}`],
  [
    /((?:api[-_]?key|authorization|token|secret|password|passwd|pwd)["'\s:=]+)[^\s,"'}]{8,}/gi,
    `$1${REDACTED}`,
  ],
  // Long hex/base64 runs are almost always a key, a hash or a session blob.
  [/\b[A-Fa-f0-9]{40,}\b/g, REDACTED],
]

/** Strip credentials from any string before it is stored or pushed to a phone. */
export function redact(value: string): string {
  return REDACTIONS.reduce(
    (acc, [pattern, replacement]) => acc.replace(pattern, replacement),
    value,
  )
}

const VARIABLE_PARTS: readonly (readonly [RegExp, string])[] = [
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<uuid>'],
  [/\bc[a-z0-9]{24}\b/g, '<cuid>'],
  [/\b[\w.+-]+@[\w-]+\.[\w.]+\b/g, '<email>'],
  [/\b0x[0-9a-f]+\b/gi, '<hex>'],
  /*
   * Mixed letter-and-digit tokens: order numbers (A1B2C3), slugs with a suffix,
   * short ids. Without this, "Order abc123 missing" and "Order zzz999 missing" get
   * separate fingerprints and one bug becomes a row per occurrence — the exact
   * failure this whole table is meant to avoid.
   *
   * The thresholds (6+ characters, 2+ digits) are the deliberate trade-off. They also
   * collapse a handful of real words like `base64` and `sha256`, so two distinct bugs
   * whose messages differ ONLY by such a word would merge. That is far the lesser
   * evil: merging two rare errors costs one confusing row, while failing to group a
   * hot loop costs the database.
   */
  [/\b(?=[a-z]*\d)(?=(?:\D*\d){2})[a-z\d]{6,}\b/gi, '<id>'],
  [/\b\d[\d,._]*\b/g, '<n>'],
]

/**
 * Collapse the parts of a message that differ between occurrences of the same bug.
 * "Order abc123 not found" and "Order def456 not found" must land on one fingerprint.
 */
export function normaliseMessage(message: string): string {
  return VARIABLE_PARTS.reduce(
    (acc, [pattern, replacement]) => acc.replace(pattern, replacement),
    message,
  )
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300)
}

/**
 * A stable, non-reversible grouping key.
 *
 * FNV-1a rather than node:crypto because this also has to run in the edge runtime,
 * where the proxy reports from. Collision risk across a few thousand distinct bugs is
 * negligible, and the consequence of one would be two bugs sharing a row — not a
 * correctness failure elsewhere.
 */
export function fingerprintOf(parts: {
  readonly source: string
  readonly name: string
  readonly message: string
  readonly routePath?: string | undefined
}): string {
  const key = [
    parts.source,
    parts.name,
    parts.routePath ?? '',
    normaliseMessage(parts.message),
  ].join('|')

  let head = 0x811c9dc5
  for (let i = 0; i < key.length; i++) {
    head ^= key.charCodeAt(i)
    head = Math.imul(head, 0x01000193) >>> 0
  }
  // A second pass over the reversed string widens the output to 64 bits, which keeps
  // the collision rate sane without pulling in a crypto dependency.
  let tail = 0x811c9dc5
  for (let i = key.length - 1; i >= 0; i--) {
    tail ^= key.charCodeAt(i)
    tail = Math.imul(tail, 0x01000193) >>> 0
  }
  return `${head.toString(16).padStart(8, '0')}${tail.toString(16).padStart(8, '0')}`
}

export interface DescribedError {
  readonly name: string
  readonly message: string
  readonly stack?: string
  readonly digest?: string
}

/** Narrow an unknown throwable into the fields worth storing. */
export function describeThrown(thrown: unknown): DescribedError {
  if (thrown instanceof Error) {
    const digest =
      'digest' in thrown && typeof thrown.digest === 'string' ? thrown.digest : undefined
    return {
      name: thrown.name || 'Error',
      message: redact(thrown.message || String(thrown)).slice(0, MAX_MESSAGE),
      ...(thrown.stack ? { stack: redact(thrown.stack).slice(0, MAX_STACK) } : {}),
      ...(digest ? { digest } : {}),
    }
  }

  if (thrown && typeof thrown === 'object') {
    const record = thrown as Record<string, unknown>
    const digest = typeof record.digest === 'string' ? record.digest : undefined
    const message =
      typeof record.message === 'string' ? record.message : safeStringify(thrown)
    return {
      name: typeof record.name === 'string' ? record.name : 'UnknownError',
      message: redact(message).slice(0, MAX_MESSAGE),
      ...(digest ? { digest } : {}),
    }
  }

  return { name: 'UnknownError', message: redact(String(thrown)).slice(0, MAX_MESSAGE) }
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value)
  } catch {
    // Circular, or a getter that throws. The type is still worth recording.
    return Object.prototype.toString.call(value)
  }
}
