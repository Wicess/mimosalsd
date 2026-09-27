import { describe, expect, it } from 'vitest'
import { scanText } from '@/lib/compliance/lexicon'
import { clampTitle, copyForLexicon, plainText, sanitizeLinks } from '@/lib/catalog/autowrite/copy'
import { factsFor, LINE_FACTS } from '@/lib/catalog/autowrite/facts'
import { writeFromTemplate, type WriteInput } from '@/lib/catalog/autowrite/template'

const links: WriteInput['links'] = {
  related: [{ label: 'Mimosa Hostilis Root Bark, Shredded', path: '/product/mhrb-shredded' }],
  guides: [{ label: 'What is Mimosa hostilis root bark?', path: '/guides/what-is-mimosa-hostilis-root-bark' }],
  labResults: '/lab-results',
  legality: '/legality',
  shipping: '/policies/shipping',
  faq: '/faq',
}

const input = (over: Partial<WriteInput> = {}): WriteInput => ({
  name: 'Mimosa Hostilis Root Bark, Fine Powder',
  line: 'MIMOSA_HOSTILIS',
  categoryName: 'Mimosa Hostilis Root Bark',
  categoryPath: '/shop/mimosa-hostilis',
  priceCents: 14_000,
  notes: '',
  imageCount: 3,
  links,
  ...over,
})

describe('the built-in writer', () => {
  it('writes an Others item under the disposables rules without calling it a vape', () => {
    const copy = writeFromTemplate(
      input({ name: 'Glass Storage Jar', line: 'VAPE', categoryName: 'Others', categoryPath: '/shop/others', categorySlug: 'others', priceCents: 1_999, notes: '' }),
      new Date('2026-09-15T12:00:00Z'),
    )
    const text = copyForLexicon(copy)
    expect(text).not.toMatch(/vapor product|undefined|lab tested|laboratory/i)
    expect(copy.shortDescription).toBe('Glass Storage Jar: $19.99 per unit, 21+ only.')
    // No delivery-signature or state-restriction wording, and no all-states promise (owner, 2026-09-15).
    expect(text).not.toMatch(/signature|photo id|all 50 states|depends on your state/i)
    expect(copy.content.faqs[0]!.answer).toContain('$19.99 per unit')
    expect(copy.content.sources).toEqual([])
    expect(copy.content.sections.every((section) => section.paragraphs.every((p) => p.trim().length > 0))).toBe(true)
    expect(scanText(text, { productLines: ['VAPE'], honourDirectives: false }).clean).toBe(true)
  })

  it('writes every part of the page from the name, price, category and photos', () => {
    const copy = writeFromTemplate(input(), new Date('2026-09-14T12:00:00Z'))
    expect(copy.writer).toBe('template')
    expect(copy.content.sections.length).toBeGreaterThanOrEqual(5)
    expect(copy.content.faqs[0]).toMatchObject({ question: 'How much is Mimosa Hostilis Root Bark, Fine Powder?' })
    expect(copy.content.faqs[0]!.answer).toContain('$140 a pound')
    expect(copy.content.faqs[0]!.answer).toContain('A 1/4 lb is $35,')
    expect(copy.content.sources).toEqual(LINE_FACTS.MIMOSA_HOSTILIS.sources)
    expect(copy.imageAlts).toEqual([
      'Mimosa Hostilis Root Bark, Fine Powder, photo 1 of 3',
      'Mimosa Hostilis Root Bark, Fine Powder, photo 2 of 3',
      'Mimosa Hostilis Root Bark, Fine Powder, photo 3 of 3',
    ])
    expect(copy.seo.metaTitle.length).toBeLessThanOrEqual(60)
    expect(copy.seo.metaDescription.length).toBeGreaterThanOrEqual(70)
    expect(copy.seo.metaDescription.length).toBeLessThanOrEqual(160)
    // Interlinked: the category, a guide, a related product, lab results and shipping.
    const text = copy.content.sections.flatMap((s) => s.paragraphs).join(' ')
    for (const path of ['/shop/mimosa-hostilis', '/guides/what-is-mimosa-hostilis-root-bark', '/product/mhrb-shredded', '/lab-results', '/policies/shipping']) {
      expect(text).toContain(`](${path})`)
    }
  })

  it('never titles sassafras as the category it happens to sit in', () => {
    // The category is "Mimosa Hostilis Root Bark"; the title used to append it.
    const copy = writeFromTemplate(
      input({ name: 'Sassafras Root Bark', productSlug: 'sassafras-root-bark' }),
      new Date('2026-09-18T12:00:00Z'),
    )
    expect(copy.seo.metaTitle).not.toMatch(/mimosa/i)
    expect(copy.seo.metaTitle).toMatch(/Sassafras Albidum/)
  })

  it.each(['MIMOSA_HOSTILIS', 'AMANITA', 'VAPE'] as const)('writes %s copy the compliance lexicon accepts', (line) => {
    const copy = writeFromTemplate(input({ line, name: line === 'VAPE' ? 'Disposable Vape, Mango' : line === 'AMANITA' ? 'Amanita Muscaria Dried Caps' : 'Mimosa Hostilis Root Bark, Fine Powder', priceCents: line === 'VAPE' ? 2_500 : 14_000 }))
    const scan = scanText(copyForLexicon(copy), { productLines: [line], honourDirectives: false })
    expect(scan.blocking.map((m) => m.term)).toEqual([])
  })

  it('prices a disposable per unit, with no sizes', () => {
    const copy = writeFromTemplate(input({ line: 'VAPE', name: 'Disposable Vape, Mango', priceCents: 2_500 }))
    expect(copy.content.faqs[0]!.answer).toBe('$25 per unit. Two cost $50, three cost $75.')
    expect(copy.description).not.toContain('1/4 lb')
    expect(copy.description).not.toMatch(/signature|photo id/i)
    // The owner: disposables are tested by second-party labs, so no third party is named (2026-09-15).
    expect(copyForLexicon(copy)).not.toMatch(/third-party/i)
    expect(copy.description).toContain('Every batch is lab-tested before it is offered for sale')
  })

  /*
    Sassafras albidum is a laurel from eastern North America. It sits in the
    mimosa-hostilis CATEGORY, so before per-product facts existed it inherited the
    mimosa LINE's species, origin, dye colours, sources and internal links, and went
    live at $170/lb describing a plant it was not selling. These hold the fix.
  */
  it('writes a sassafras page about sassafras, not about mimosa', () => {
    const copy = writeFromTemplate(
      input({
        name: 'Sassafras Root Bark',
        productSlug: 'sassafras-root-bark',
        categorySlug: 'mimosa-hostilis',
        priceCents: 17_000,
      }),
    )
    const text = copyForLexicon(copy)
    expect(text).toContain('Sassafras albidum')
    expect(text).toContain('eastern North America')
    // The mimosa BIOGRAPHY, in every place it used to leak through. The category name
    // and the sibling products are still mimosa, and still say so: that part is true.
    expect(text).not.toMatch(/tenuiflora|brazil/i)
    expect(text).not.toMatch(/deep purple|high tannin/i)
    expect(copy.shortDescription).toContain('Sassafras root bark is a raw botanical material')
    expect(copy.shortDescription).not.toMatch(/tenuiflora/i)
    expect(copy.content.sources.map((s) => s.url)).not.toContain('https://en.wikipedia.org/wiki/Mimosa_tenuiflora')
    // And it points at its own reading, not at the mimosa guide and the mimosa dyeing post.
    const own = factsFor('MIMOSA_HOSTILIS', 'mimosa-hostilis', 'sassafras-root-bark')
    expect(own.guideSlugs).not.toContain('what-is-mimosa-hostilis-root-bark')
    expect(own.postSlugs).not.toContain('natural-dyeing-with-mimosa-hostilis')
    // It is in that category, and says so without claiming to be that range.
    expect(text).toContain('though it is a different plant')
    expect(text).not.toContain('It is part of our [Mimosa Hostilis Root Bark]')
    // The federal position on sassafras in food, which is why it is craft material here.
    expect(text).toContain('21 CFR 189.180')
    expect(text).toContain('not for human consumption')
    expect(scanText(text, { productLines: ['MIMOSA_HOSTILIS'], honourDirectives: false }).blocking).toEqual([])
  })

  it('leaves every other botanical product on the line facts', () => {
    const copy = writeFromTemplate(input({ productSlug: 'mhrb-powder-500g' }))
    expect(copy.content.sources).toEqual(LINE_FACTS.MIMOSA_HOSTILIS.sources)
    expect(copy.description).toContain('It is part of our Mimosa Hostilis Root Bark range.')
  })

  it("uses the owner's notes", () => {
    const copy = writeFromTemplate(input({ notes: 'Harvested in Pernambuco' }))
    expect(copy.description).toContain('Harvested in Pernambuco.')
  })
})

describe('the rules every writer passes through', () => {
  it('keeps only links to allowed pages, and keeps the words of the rest', () => {
    const allowed = new Set(['/lab-results'])
    expect(sanitizeLinks('See [the reports](/lab-results) and [this](https://evil.example) or [that](javascript:alert(1)).', allowed)).toBe(
      'See [the reports](/lab-results) and this or that).',
    )
    expect(plainText('A [link](/x) here')).toBe('A link here')
  })

  it('cuts a title on a word, at most 60 characters', () => {
    const title = clampTitle('Mimosa Hostilis Root Bark Powder, Extra Fine Mill | $140.61 per lb | MIMOSALSD')
    expect(title.length).toBeLessThanOrEqual(60)
    expect(title.endsWith('|')).toBe(false)
  })

  it('cites only sources that were checked and are real addresses', () => {
    for (const facts of Object.values(LINE_FACTS)) {
      for (const source of facts.sources) expect(source.url).toMatch(/^https:\/\/[a-z0-9.-]+\//)
    }
    for (const source of factsFor('MIMOSA_HOSTILIS', 'mimosa-hostilis', 'sassafras-root-bark').sources) {
      expect(source.url).toMatch(/^https:\/\/[a-z0-9.-]+\//)
    }
  })

  it('narrows facts product over category over line', () => {
    const line = factsFor('MIMOSA_HOSTILIS')
    const product = factsFor('MIMOSA_HOSTILIS', 'mimosa-hostilis', 'sassafras-root-bark')
    // Its own species facts...
    expect(product.whatItIs).not.toEqual(line.whatItIs)
    // ...but the line's commercial terms, which are true of everything sold by the pound.
    expect(product.soldBy).toBe('lb')
    expect(product.advantages).toEqual(line.advantages)
    // An unknown slug changes nothing.
    expect(factsFor('MIMOSA_HOSTILIS', 'mimosa-hostilis', 'no-such-product').whatItIs).toEqual(line.whatItIs)
  })
})
