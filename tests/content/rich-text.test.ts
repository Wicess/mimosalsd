import { describe, expect, it } from 'vitest'
import { citationsIn, isCitableSource, isInternalPath } from '@/components/content/rich-text'

/*
  Article bodies are operator input from the admin panel, and the link target inside
  one is whatever somebody typed or pasted. Rather than sanitise a bad href, the
  renderer links ONLY targets that match a known internal prefix and drops the rest to
  plain words. These pin the boundary.
*/
describe('link targets an article body may render', () => {
  it.each([
    '/product/sassafras-root-bark',
    '/shop',
    '/shop/mimosa-hostilis',
    '/blog/eight-mistakes-in-a-first-dye-bath',
    '/guides/what-is-mimosa-hostilis-root-bark',
    '/policies/shipping',
    '/lab-results',
    '/where-we-ship/texas',
    '/faq',
    '/bulk',
    '/contact',
  ])('links %s', (path) => {
    expect(isInternalPath(path)).toBe(true)
  })

  it.each([
    ['https://evil.example/x', 'absolute URL'],
    ['//evil.example/x', 'protocol-relative — starts with a slash but is not internal'],
    ['javascript:alert(1)', 'script scheme'],
    ['/product/../../etc/passwd', 'traversal'],
    ['/admin', 'not on the allowlist'],
    ['/api/catalog/posted-slugs', 'not on the allowlist'],
    ['/checkout', 'noindex route'],
    ['mailto:someone@example.com', 'external scheme'],
    ['product/no-leading-slash', 'relative'],
    ['', 'empty'],
  ])('refuses %s (%s)', (path) => {
    expect(isInternalPath(path)).toBe(false)
  })

  it('refuses a protocol-relative URL even though it starts with a slash', () => {
    // The ordering of the checks is what makes this pass; keep "//" tested first.
    expect(isInternalPath('//mimosalsd.com.evil.example/product/x')).toBe(false)
  })

  it('accepts a prefix exactly as well as beneath it', () => {
    expect(isInternalPath('/shop')).toBe(true)
    expect(isInternalPath('/shop/others')).toBe(true)
    expect(isInternalPath('/lab-results')).toBe(true)
    expect(isInternalPath('/lab-results/batch111093')).toBe(true)
  })
})

/*
  Citations: an external link renders only when it points at a primary source — a
  government or standards body — over https. Everything else keeps its words.
*/
describe('external sources an article body may cite', () => {
  it.each([
    'https://www.ecfr.gov/current/title-7/subtitle-B/chapter-IX/part-990/subpart-A/section-990.1',
    'https://www.federalregister.gov/documents/2021/10/21/2021-22787/treatment-of-e-cigarettes-in-the-mail',
    'https://www.fda.gov/food/hfp-constituent-updates/fda-alerts-industry-and-consumers-about-use-amanita-muscaria-or-its-constituents-food',
    'https://www.epa.gov/recycle/used-lithium-ion-batteries',
    'https://www.iso.org/standard/66912.html',
    'https://www.deadiversion.usdoj.gov/chem_prog/advisories/safrole.html',
  ])('cites %s', (target) => {
    expect(isCitableSource(target)).toBe(true)
  })

  it.each([
    ['http://www.fda.gov/x', 'not https'],
    ['https://fda.gov.evil.example/x', 'lookalike host'],
    ['https://notfda.gov/x', 'a host that merely ends in the same letters'],
    ['https://user:pass@www.fda.gov/x', 'credentials'],
    ['https://www.fda.gov:8443/x', 'a port'],
    ['https://en.wikipedia.org/wiki/Safrole', 'a secondary source'],
    ['https://some-shop.example/amanita', 'a seller'],
    ['javascript:alert(1)', 'script scheme'],
    ['not a url', 'garbage'],
  ])('refuses %s (%s)', (target) => {
    expect(isCitableSource(target)).toBe(false)
  })

  it('collects each cited source once, in order, and ignores everything else', () => {
    const blocks = [
      'See [7 CFR 990.1](https://www.ecfr.gov/a) and [a shop](https://shop.example/x).',
      '- [EPA](https://www.epa.gov/b)\n- [7 CFR 990.1 again](https://www.ecfr.gov/a)',
      '[internal](/blog/x)',
    ]
    expect(citationsIn(blocks)).toEqual(['https://www.ecfr.gov/a', 'https://www.epa.gov/b'])
  })
})
