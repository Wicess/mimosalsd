import { describe, expect, it } from 'vitest'
import { FAQ_CATEGORIES, FAQ_ITEMS } from '@/lib/content/faq'
import { discountPercent } from '@/lib/orders/payment-discount'

describe('FAQ content', () => {
  it('gives every item a question, an answer and a known category', () => {
    for (const item of FAQ_ITEMS) {
      expect(item.question.trim().length, item.question).toBeGreaterThan(8)
      expect(item.answer.trim().length, item.question).toBeGreaterThan(40)
      expect(FAQ_CATEGORIES, item.question).toContain(item.category)
    }
  })

  it('asks no question twice', () => {
    const seen = FAQ_ITEMS.map((i) => i.question.toLowerCase())
    expect(new Set(seen).size).toBe(seen.length)
  })

  it('fills every category', () => {
    for (const category of FAQ_CATEGORIES) {
      expect(FAQ_ITEMS.filter((i) => i.category === category).length, category).toBeGreaterThan(0)
    }
  })

  /*
   * The rate lives in one place. Copy that hardcodes a percentage keeps its old value
   * forever the day the rate moves, which is how a legality page went on publishing
   * "minimum age 18" for months after the floor became 21.
   */
  it('quotes the Bitcoin discount at the live rate', () => {
    const pct = discountPercent('BITCOIN')
    const mentions = FAQ_ITEMS.filter((i) => /bitcoin/i.test(i.answer) && /%/.test(i.answer))
    expect(mentions.length).toBeGreaterThan(0)
    for (const item of mentions) {
      for (const found of item.answer.match(/(\d+)%/g) ?? []) {
        expect(found, item.question).toBe(`${pct}%`)
      }
    }
  })

  it('answers first — no answer opens by restating the question', () => {
    for (const item of FAQ_ITEMS) {
      expect(item.answer.toLowerCase().startsWith(item.question.toLowerCase().slice(0, 12))).toBe(false)
    }
  })
})
