import { describe, expect, it } from 'vitest'
import { MAX_DESCRIPTION_LENGTH, MIN_DESCRIPTION_LENGTH, autoMeta, clampDescription, pageMetadata, sanitizeMeta } from '@/lib/seo/meta'
import { POLICIES } from '@/lib/content/policies'
import { FAQ_ITEMS } from '@/lib/content/faq'
import { publishedGuides, publishedPosts } from '@/lib/content/content.data'
import { catalog } from '@/lib/catalog/repository'

describe('clampDescription', () => {
  it('leaves a description that already fits untouched', () => {
    const short = 'Third-party lab results for every batch, and a verified legal status for every state.'
    expect(clampDescription(short)).toBe(short)
  })

  it('never exceeds the limit', () => {
    const long = 'word '.repeat(200)
    expect(clampDescription(long).length).toBeLessThanOrEqual(MAX_DESCRIPTION_LENGTH)
  })

  it('cuts on a word boundary rather than mid-word', () => {
    // Was an ellipsis until 2026-09-17. The owner banned symbols from the meta tags,
    // and a trailing "…" also duplicates the one the engine appends itself.
    const out = clampDescription('a'.repeat(40) + ' ' + 'b'.repeat(200))
    expect(out).toBe('a'.repeat(40) + '.')
  })

  it('collapses whitespace so a wrapped source string does not leak newlines', () => {
    expect(clampDescription('one\n  two\t three')).toBe('one two three')
  })

  it('does not append a second full stop when the trimmed text already ends a sentence', () => {
    const text = 'Ships to all fifty states. ' + 'x'.repeat(200)
    expect(clampDescription(text)).toBe('Ships to all fifty states.')
  })

  it('ends on the last whole sentence rather than half of the next one', () => {
    // The live description for a cartridge read "...a 510 battery you already own. Sold by the unit to."
    const text =
      'Muha Meds Toro Milk Runtz is a 510-thread cartridge from Muha Meds, not an all-in-one device, it screws onto a 510 battery you already own. Sold by the unit to adults 21 and over.'
    expect(clampDescription(text)).toBe(
      'Muha Meds Toro Milk Runtz is a 510-thread cartridge from Muha Meds, not an all-in-one device, it screws onto a 510 battery you already own.',
    )
  })

  it('falls back to a word boundary when the last whole sentence would be too thin', () => {
    const out = clampDescription('Short one. ' + 'word '.repeat(60))
    expect(out.length).toBeGreaterThanOrEqual(MIN_DESCRIPTION_LENGTH)
    expect(out).toMatch(/word\.$/)
  })

  it('keeps a sentence that ends exactly on the limit', () => {
    const first = 'A finished device contains a lithium cell and does not belong in a household bin. '
    const second = 'Crushed cells start fires.'.padStart(MAX_DESCRIPTION_LENGTH - first.length, 'x')
    const out = clampDescription(first + second + ' And more words follow here.')
    expect(out.length).toBe(MAX_DESCRIPTION_LENGTH)
    expect(out.endsWith('Crushed cells start fires.')).toBe(true)
  })

  it('cuts at the last clause when the last whole sentence would be too thin', () => {
    const text =
      'Shredded bark is rarely spent after one bath. A second gives roughly half to two-thirds the depth, and a third gives a pale tint that is often the prettiest on silk.'
    expect(clampDescription(text)).toBe(
      'Shredded bark is rarely spent after one bath. A second gives roughly half to two-thirds the depth.',
    )
  })

  it('does not treat a decimal point as the end of a sentence', () => {
    const text = 'A 0.5 gram cartridge ' + 'with a long description that keeps going '.repeat(6)
    expect(clampDescription(text)).not.toBe('A 0.')
  })

  it('leaves no dangling punctuation before the ellipsis', () => {
    const out = clampDescription('Potency, heavy metals, ' + 'z'.repeat(200))
    expect(out).not.toMatch(/[\s,;:—–-]+…$/)
  })
})

/**
 * Google truncates around 155–160 characters. Six descriptions shipped over that —
 * one at 288 — which meant the half of the answer that made the page worth clicking
 * was being cut off in the results. On a site whose only acquisition channel is
 * organic search, the snippet IS the advert.
 *
 * These assert the SOURCE strings clamp to something usable, so a new product or
 * policy cannot quietly reintroduce the problem.
 */
describe('every description source produces a usable snippet', () => {
  const sources: Array<[string, string]> = [
    ...POLICIES.map((p) => [`policy:${p.slug}`, p.metaDescription] as [string, string]),
    ...publishedGuides().map((g) => [`guide:${g.slug}`, g.summary] as [string, string]),
    ...publishedPosts().map((p) => [`post:${p.slug}`, p.summary] as [string, string]),
    ...catalog
      .listCategories()
      .map((c) => [`category:${c.slug}`, c.metaDesc] as [string, string]),
    ...catalog
      .listProducts()
      .map((p) => [`product:${p.slug}`, p.shortDescription] as [string, string]),
  ]

  it.each(sources)('%s clamps within the SERP limit', (_label, text) => {
    expect(clampDescription(text).length).toBeLessThanOrEqual(MAX_DESCRIPTION_LENGTH)
  })

  it.each(sources)('%s is substantial enough to earn a click', (_label, text) => {
    expect(text.trim().length).toBeGreaterThanOrEqual(MIN_DESCRIPTION_LENGTH)
  })
})

/**
 * The FAQ is the page most likely to be lifted whole by an answer engine, so the
 * shape of each entry matters as much as its accuracy.
 */
describe('FAQ entries stay answer-first', () => {
  it('asks a real question in every question field', () => {
    for (const item of FAQ_ITEMS) {
      expect(item.question.endsWith('?'), item.question).toBe(true)
    }
  })

  it('gives every question a substantive answer', () => {
    for (const item of FAQ_ITEMS) {
      expect(item.answer.length, item.question).toBeGreaterThan(120)
    }
  })

  it('never asks the same question twice — duplicates split the citation', () => {
    const questions = FAQ_ITEMS.map((i) => i.question.toLowerCase())
    expect(new Set(questions).size).toBe(questions.length)
  })
})

/*
  Owner, 2026-09-17: "do not add symbols to the metatags".

  The generated title read `Muha Meds Juice Man | $24 | MIMOSALSD`. Pipes a search
  engine gives no weight to, a brand suffix this site decided not to spend characters
  on, and a price that goes stale in a frozen string without anything re-reading it.
*/
describe('symbols in a title or description', () => {
  it('takes the symbols out of the title the writer used to produce', () => {
    expect(sanitizeMeta('Muha Meds Juice Man | $24 | MIMOSALSD')).toBe('Muha Meds Juice Man, MIMOSALSD')
    expect(sanitizeMeta('Mimosa Hostilis Root Bark Powder & Shredded — Lab-Tested, US-Packed')).toBe(
      'Mimosa Hostilis Root Bark Powder and Shredded, Lab-Tested, US-Packed',
    )
  })

  it('drops a price rather than reformatting it', () => {
    // A price in a stored string is true the day it is written and false afterwards.
    expect(sanitizeMeta('Sold at $1,500.00 a pound.')).toBe('Sold at a pound.')
    expect(sanitizeMeta('£99 and €49.50 and ¥1200')).toBe('and and')
  })

  it('keeps the punctuation English is written with', () => {
    // A hyphen inside a word, an apostrophe and a full stop are not decoration.
    expect(sanitizeMeta("Dante's Inferno is lab-tested. Sold by the pound.")).toBe(
      "Dante's Inferno is lab-tested. Sold by the pound.",
    )
    // Curly quotes become the plain apostrophe; smart double quotes go entirely.
    expect(sanitizeMeta('“Golden” Teacher’s bark')).toBe("Golden Teacher's bark")
  })

  it('writes the age limit in words, because "+" is a symbol', () => {
    expect(sanitizeMeta('Sold to adults 21+ only.')).toBe('Sold to adults 21 and over only.')
  })

  it('is idempotent, because it runs both at write time and at render time', () => {
    const once = sanitizeMeta('A | B — C & D')
    expect(sanitizeMeta(once)).toBe(once)
    expect(once).toBe('A, B, C and D')
  })

  it('leaves no doubled commas or a comma against a full stop', () => {
    expect(sanitizeMeta('Ghost 2G | | $14 | .')).not.toMatch(/,\s*,|,\s*\./)
    expect(sanitizeMeta('One | two.')).toBe('One, two.')
  })

  it('never begins or ends on a separator', () => {
    for (const input of ['| leading', 'trailing |', '— both —', ': colon', '$24']) {
      const out = sanitizeMeta(input)
      expect(out).not.toMatch(/^[\s,.;:|—–-]/)
      expect(out).not.toMatch(/[\s,;:|—–-]$/)
    }
  })

  it('ends a clamped description on a word and a full stop, never an ellipsis', () => {
    const long = `${'Mimosa hostilis root bark is a raw botanical material. '.repeat(6)}`
    const out = clampDescription(long)
    expect(out.length).toBeLessThanOrEqual(160)
    expect(out).not.toContain('…')
    expect(out).toMatch(/[.!?]$/)
    expect(out.endsWith(' ')).toBe(false)
  })
})

describe('metadata derived when the operator leaves the fields blank', () => {
  it('derives both from the content', () => {
    const meta = autoMeta({
      title: 'What Is Mimosa Hostilis Root Bark?',
      summary: 'Mimosa hostilis root bark is a raw botanical material sold for natural dyeing, soap and craft. It is not food and not for human consumption.',
    })
    // A question mark is how the title is written, so it stays.
    expect(meta.metaTitle).toBe('What Is Mimosa Hostilis Root Bark?')
    expect(meta.metaDescription.length).toBeGreaterThanOrEqual(70)
    expect(meta.metaDescription.length).toBeLessThanOrEqual(160)
  })

  it('prefers what the operator typed, and sanitises it too', () => {
    const meta = autoMeta({
      title: 'Ignored',
      summary: 'Ignored summary.',
      metaTitle: 'Buy THCA Disposables | $24 each',
      metaDesc: 'Lab tested & discreet — ships fast.',
    })
    expect(meta.metaTitle).toBe('Buy THCA Disposables, each')
    expect(meta.metaDescription).toBe('Lab tested and discreet, ships fast.')
  })

  it('falls back to the body when there is no summary', () => {
    const meta = autoMeta({ title: 'A post', summary: '', body: 'The opening paragraph answers the question directly.' })
    expect(meta.metaDescription).toBe('The opening paragraph answers the question directly.')
  })

  it('clamps a title past the truncation point on a word', () => {
    const meta = autoMeta({ title: 'A Very Long Title About Mimosa Hostilis Root Bark Powder For Natural Dyeing Projects', summary: 'x' })
    expect(meta.metaTitle.length).toBeLessThanOrEqual(60)
    expect(meta.metaTitle.endsWith(' ')).toBe(false)
  })
})

/*
  app/opengraph-image.tsx generates a site share card and Next attaches it by file
  convention — but a route declaring its own `openGraph` object replaces the
  inherited one, and pageMetadata declares one on every page it touches. The result
  was `twitter:card = summary_large_image` with no image anywhere on it, so a pasted
  link rendered a large empty card. The home page looked fine because it does not
  route through here, which is why it went unnoticed.
*/
describe('every page carries a share card image', () => {
  const base = { title: 'A Post', description: 'x'.repeat(90), path: '/blog/a-post' }

  it('falls back to the generated site card', () => {
    const meta = pageMetadata(base)
    expect(meta.openGraph?.images).toBeDefined()
    expect(meta.twitter?.images).toBeDefined()
    expect(JSON.stringify(meta.openGraph?.images)).toContain('/opengraph-image')
  })

  it('uses the page image when one is supplied', () => {
    const meta = pageMetadata({ ...base, image: { url: 'https://cdn.example/media/abc.jpg', alt: 'Illustration' } })
    expect(JSON.stringify(meta.openGraph?.images)).toContain('https://cdn.example/media/abc.jpg')
    expect(JSON.stringify(meta.twitter?.images)).toContain('https://cdn.example/media/abc.jpg')
  })

  it('never declares a large-image card without an image', () => {
    for (const meta of [pageMetadata(base), pageMetadata({ ...base, type: 'article' })]) {
      if (meta.twitter && 'card' in meta.twitter && meta.twitter.card === 'summary_large_image') {
        expect(meta.twitter.images, 'large-image card with no image').toBeDefined()
      }
    }
  })

  it('gives the card the same sanitised title as the page', () => {
    const meta = pageMetadata({ ...base, title: 'Buy THCA | $24 each' })
    expect(meta.openGraph?.title).toBe('Buy THCA, each')
    expect(JSON.stringify(meta.openGraph?.images)).toContain('alt')
  })
})
