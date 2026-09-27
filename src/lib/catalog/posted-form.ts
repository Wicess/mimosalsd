import {
  postedDocumentSchema,
  variantIdentity,
  type PostedDocument,
} from './posted-product'
import type { ProductLine } from '@/lib/compliance/types'
import { variantsForLadder, type ProductImage } from './types'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  THE POST-A-PRODUCT FORM, READ.
 *
 *  Pure: FormData in, a checked draft or a sentence the operator can act on out.
 *  The server action around it does the database, the upload and the audit; the
 *  rules for what a posted product may say and cost live here, where they can be
 *  tested without either.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface PostedFormInput {
  readonly categorySlug: string
  readonly name: string
  readonly shortDescription: string
  readonly description: string
  readonly specs: ReadonlyArray<readonly [string, string]>
  /** The price of a full pound, or of one unit for a disposable. */
  readonly priceCents: number
  readonly inStock: boolean
  readonly batchCodes: readonly string[]
  readonly isFeatured: boolean
  readonly onStateDirectory: boolean
  readonly photoAlt: string
  readonly removePhoto: boolean
}

type Result<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: string }

const text = (formData: FormData, key: string) => String(formData.get(key) ?? '').trim()

/** "19", "19.9", "$1,299.00" → cents. Anything else, including zero, is null. */
export function parseDollars(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null
  const cents = Math.round(Number(cleaned) * 100)
  return cents > 0 ? cents : null
}

/** "Label | Value" per line, the same format the product editor uses. */
export function parseSpecLines(raw: string): Array<[string, string]> {
  return raw
    .split('\n')
    .map((line) => line.split('|'))
    .filter((parts) => parts.length >= 2)
    .map((parts) => [parts[0]!.trim(), parts.slice(1).join('|').trim()] as [string, string])
    .filter(([label, value]) => label !== '' && value !== '')
}

/**
 * The form, read. Sizes arrive as parallel lists (one entry per row), and a row
 * with no name is a row the operator left blank, not an error.
 */
export function readPostedForm(formData: FormData): Result<PostedFormInput> {
  const priceCents = parseDollars(String(formData.get('price') ?? ''))
  if (priceCents === null) {
    return { ok: false, error: 'Set the price: per pound, or per unit for a disposable. Write it like 140 or 24.99.' }
  }

  return {
    ok: true,
    value: {
      categorySlug: text(formData, 'categorySlug'),
      name: text(formData, 'name'),
      shortDescription: text(formData, 'shortDescription'),
      description: text(formData, 'description'),
      specs: parseSpecLines(String(formData.get('specs') ?? '')),
      priceCents,
      inStock: formData.get('stock') !== 'out',
      batchCodes: [...new Set(formData.getAll('batchCodes').map(String).filter(Boolean))],
      isFeatured: formData.get('isFeatured') === 'on',
      onStateDirectory: formData.get('onStateDirectory') === 'on',
      photoAlt: text(formData, 'photoAlt'),
      removePhoto: formData.get('removePhoto') === 'on',
    },
  }
}

/** Every word a customer will read, for the compliance lexicon. Size names included. */
export function copyForScan(input: PostedFormInput): string {
  return [
    input.name,
    input.shortDescription,
    input.description,
    ...input.specs.flat(),
    input.photoAlt,
  ]
    .filter(Boolean)
    .join('\n')
}

const FIELD_LABELS: Record<string, string> = {
  name: 'The name',
  shortDescription: 'The short description',
  description: 'The description',
  specs: 'The specification lines',
  variants: 'The price',
  poundPriceCents: 'The price per pound',
  images: 'The photo',
  batchCodes: 'The lab batches',
}

/** The stored document, checked against the same schema the storefront reads with. */
export function buildDocument(
  slug: string,
  input: PostedFormInput,
  images: readonly ProductImage[],
  line: ProductLine,
): Result<PostedDocument> {
  /*
    A disposable is one unit at its unit price. Everything else is sold by the pound:
    the sizes are generated from the pound price, the same way as the built-in
    products, and the pound price is stored so they can be generated again.
  */
  const variants =
    line === 'VAPE'
      ? [{ ...variantIdentity(slug, 'Single unit'), name: 'Single unit', priceCents: input.priceCents, inStock: input.inStock }]
      : variantsForLadder(slug, { poundPriceCents: input.priceCents, defaultKey: 'f4' }).map((v) => ({
          id: v.id,
          sku: `P-${v.sku}`.slice(0, 80),
          name: v.name,
          priceCents: v.priceCents,
          inStock: input.inStock,
        }))
  const parsed = postedDocumentSchema.safeParse({
    name: input.name,
    shortDescription: input.shortDescription,
    description: input.description,
    specs: input.specs,
    variants,
    ...(line === 'VAPE' ? {} : { poundPriceCents: input.priceCents }),
    images,
    batchCodes: input.batchCodes,
    isFeatured: input.isFeatured,
    onStateDirectory: input.onStateDirectory,
  })
  if (parsed.success) return { ok: true, value: parsed.data }

  const issue = parsed.error.issues[0]!
  const field = FIELD_LABELS[String(issue.path[0])] ?? 'A field'
  const detail =
    issue.code === 'too_small'
      ? `is too short (at least ${String(issue.minimum)}${issue.type === 'string' ? ' characters' : ''})`
      : issue.code === 'too_big'
        ? `is too long (at most ${String(issue.maximum)}${issue.type === 'string' ? ' characters' : ''})`
        : 'is not valid'
  return { ok: false, error: `${field} ${detail}.` }
}
