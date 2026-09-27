import { describe, expect, it } from 'vitest'
import {
  buildDocument,
  copyForScan,
  parseDollars,
  parseSpecLines,
  readPostedForm,
} from '@/lib/catalog/posted-form'

function form(fields: Record<string, string | string[]>): FormData {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    for (const v of Array.isArray(value) ? value : [value]) data.append(key, v)
  }
  return data
}

const BASE = {
  categorySlug: 'amanita',
  name: 'Dried Amanita Caps',
  shortDescription: 'Whole dried caps, third-party batch tested.',
  description: 'Whole dried Amanita muscaria caps, third-party batch tested and packed in the United States.',
  specs: 'Species | Amanita muscaria\nnonsense line\nMade in | United States',
  price: '$1,200',
  stock: 'in',
}

describe('parseDollars', () => {
  it.each([
    ['19', 1900],
    ['19.9', 1990],
    ['$1,299.00', 129900],
    [' 0.5 ', 50],
  ])('%j → %d cents', (raw, cents) => expect(parseDollars(raw)).toBe(cents))

  it.each(['', '0', '0.00', '-5', 'abc', '1.999', '12.3.4'])('refuses %j', (raw) => {
    expect(parseDollars(raw)).toBeNull()
  })
})

describe('parseSpecLines', () => {
  it('keeps "Label | Value" lines and ignores the rest', () => {
    expect(parseSpecLines(BASE.specs)).toEqual([
      ['Species', 'Amanita muscaria'],
      ['Made in', 'United States'],
    ])
  })

  it('keeps a pipe inside the value', () => {
    expect(parseSpecLines('Sizes | 7g | 14g')).toEqual([['Sizes', '7g | 14g']])
  })
})

describe('readPostedForm', () => {
  it('reads one price and the stock', () => {
    const read = readPostedForm(form(BASE))
    if (!read.ok) throw new Error(read.error)
    expect(read.value).toMatchObject({ priceCents: 120_000, inStock: true })
    const out = readPostedForm(form({ ...BASE, stock: 'out' }))
    expect(out.ok && out.value.inStock).toBe(false)
  })

  it('refuses a form without a real price', () => {
    for (const price of ['', 'free', '0']) {
      expect(readPostedForm(form({ ...BASE, price })).ok).toBe(false)
    }
  })
})

describe('copyForScan', () => {
  it('includes every word a customer reads', () => {
    const read = readPostedForm(form(BASE))
    if (!read.ok) throw new Error(read.error)
    expect(copyForScan(read.value)).toContain('Amanita muscaria')
    expect(copyForScan(read.value)).toContain('Dried Amanita Caps')
  })
})

describe('buildDocument', () => {
  it('sells a weighed product in the four pound sizes, priced from the pound price', () => {
    const read = readPostedForm(form(BASE))
    if (!read.ok) throw new Error(read.error)
    const doc = buildDocument('dried-amanita-caps', read.value, [], 'AMANITA')
    if (!doc.ok) throw new Error(doc.error)
    expect(doc.value.poundPriceCents).toBe(120_000)
    expect(doc.value.variants.map((v) => [v.id, v.sku, v.name, v.priceCents])).toEqual([
      ['dried-amanita-caps-f4', 'P-DRIED-AMANITA-CAPS-QTR-LB', '1/4 lb', 30_000],
      ['dried-amanita-caps-f3', 'P-DRIED-AMANITA-CAPS-THIRD-LB', '1/3 lb', 40_000],
      ['dried-amanita-caps-f2', 'P-DRIED-AMANITA-CAPS-HALF-LB', '1/2 lb', 60_000],
      ['dried-amanita-caps-f1', 'P-DRIED-AMANITA-CAPS-1-LB', '1 lb', 120_000],
    ])
  })

  it('sells a disposable as one unit at its unit price', () => {
    const read = readPostedForm(form({ ...BASE, categorySlug: 'disposable-vapes', price: '24.99' }))
    if (!read.ok) throw new Error(read.error)
    const doc = buildDocument('vape-mango', read.value, [], 'VAPE')
    if (!doc.ok) throw new Error(doc.error)
    expect(doc.value.poundPriceCents).toBeUndefined()
    expect(doc.value.variants).toEqual([
      { id: 'vape-mango--single-unit', sku: 'P-VAPE-MANGO-SINGLE-UNIT', name: 'Single unit', priceCents: 2_499, inStock: true },
    ])
  })

  it('explains a copy field that is too short in words an operator can act on', () => {
    const read = readPostedForm(form({ ...BASE, shortDescription: 'Too short' }))
    if (!read.ok) throw new Error(read.error)
    const doc = buildDocument('x', read.value, [], 'AMANITA')
    expect(doc).toEqual({
      ok: false,
      error: 'The short description is too short (at least 20 characters).',
    })
  })
})
