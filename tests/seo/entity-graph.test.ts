import { DEFAULT_COMPANY_EMAIL } from '@/lib/site/company-email'
import { describe, expect, it } from 'vitest'
import {
  breadcrumbList,
  collectionPage,
  faqPage,
  organization,
  organizationId,
  organizationRef,
  jsonLdScript,
  website,
} from '@/lib/seo/structured-data'
import { FAQ_ITEMS } from '@/lib/content/faq'
import { BRAND } from '@/lib/brand'

/**
 * Bing §16 asks for clear, consistent entity definition, and §14 says markup must
 * accurately reflect visible content. The way both fail quietly is a graph where every
 * page declares a fresh, unlinked Organization and nothing joins them up.
 */
describe('one organisation, referenced everywhere', () => {
  it('gives the organisation a stable @id', () => {
    expect(organization(DEFAULT_COMPANY_EMAIL)['@id']).toBe(organizationId())
    expect(organizationId()).toMatch(/#organization$/)
  })

  it('makes a reference that points at exactly that id', () => {
    expect(organizationRef()['@id']).toBe(organization(DEFAULT_COMPANY_EMAIL)['@id'])
  })

  it('has the website published by the same entity', () => {
    expect(website().publisher['@id']).toBe(organizationId())
  })

  it('joins a collection page to the website rather than redeclaring it', () => {
    const node = collectionPage({
      name: 'Shop', description: 'x', path: '/shop', items: [],
    })
    expect(node.isPartOf['@id']).toBe(website()['@id'])
  })
})

/**
 * `BRAND` ships with empty placeholders until the domain and socials exist. An empty
 * `sameAs: []` or a logo pointing nowhere is a broken entity claim, which is worse
 * than an absent one — so those fields must be omitted, not emitted empty.
 */
describe('placeholder-safe entity fields', () => {
  it('omits sameAs entirely while the social handles are blank', () => {
    expect(organization(DEFAULT_COMPANY_EMAIL)).not.toHaveProperty('sameAs')
  })

  /*
    The number landed on 2026-09-27, so the blank case is no longer observable here.
    What still has to hold is the FORM: schema.org wants E.164, and the site keeps a
    separate readable spelling for people. If those two ever swap places, a search
    engine gets "+1 (608) 556-4932" as a machine-readable number.
  */
  it('emits telephone in E.164, not the readable spelling', () => {
    const node = organization(DEFAULT_COMPANY_EMAIL)
    expect(node.telephone).toBe(BRAND.phoneE164)
    expect(node.telephone).toMatch(/^\+[1-9]\d{7,14}$/)
    expect(node.telephone).not.toContain(' ')
  })

  it('gives the contact point the same number', () => {
    expect(organization(DEFAULT_COMPANY_EMAIL).contactPoint[0]?.telephone).toBe(BRAND.phoneE164)
  })

  it('still declares a contact point, which needs no placeholder', () => {
    expect(organization(DEFAULT_COMPANY_EMAIL).contactPoint.length).toBeGreaterThan(0)
  })
})

describe('breadcrumbs', () => {
  it('numbers positions from one, in order', () => {
    const node = breadcrumbList([
      { name: 'Shop', path: '/shop' },
      { name: 'Amanita', path: '/shop/amanita' },
    ])
    expect(node.itemListElement.map((i) => i.position)).toEqual([1, 2])
    expect(node.itemListElement[0]!.item).toMatch(/\/shop$/)
  })

  it('absolutises every item — a crawler reads the JSON out of context', () => {
    for (const item of breadcrumbList([{ name: 'A', path: '/a' }]).itemListElement) {
      expect(item.item).toMatch(/^https?:\/\//)
    }
  })
})

/**
 * The FAQ markup is generated from the same array the page renders. If these ever
 * diverge, the page is marking up answers a visitor cannot read — the exact violation
 * that got the product page's fabricated rating removed.
 */
describe('FAQ markup matches what the page renders', () => {
  it('marks up every rendered question and no others', () => {
    const node = faqPage(FAQ_ITEMS.map((i) => ({ question: i.question, answer: i.answer })))
    expect(node.mainEntity).toHaveLength(FAQ_ITEMS.length)
    expect(node.mainEntity.map((q) => q.name)).toEqual(FAQ_ITEMS.map((i) => i.question))
  })

  it('carries the full answer text, not a truncation', () => {
    const node = faqPage([{ question: 'Q?', answer: 'A'.repeat(500) }])
    expect(node.mainEntity[0]!.acceptedAnswer.text).toHaveLength(500)
  })
})

describe('serialisation', () => {
  it('escapes < so a string cannot close the script tag', () => {
    expect(jsonLdScript({ x: '</script><script>alert(1)</script>' })).not.toContain('</script>')
  })
})
