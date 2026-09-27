import { describe, expect, it } from 'vitest'
import { hasNotSoldDisclaimer, parseAllowDirectives, scanReview, scanText } from '@/lib/compliance/lexicon'

describe('lexicon — Mimosa Hostilis scope', () => {
  it('blocks extraction and consumption language on MHRB surfaces', () => {
    const r = scanText('Our bark gives an excellent yield when you brew a tea.', {
      productLines: ['MIMOSA_HOSTILIS'],
    })
    expect(r.clean).toBe(false)
    expect(r.blocking.map((m) => m.term)).toEqual(
      expect.arrayContaining(['yield', 'brew', 'tea']),
    )
  })

  it('does NOT apply MHRB-scoped terms to an unrelated surface', () => {
    const r = scanText('Brew a cup of tea while you read.', { productLines: ['AMANITA'] })
    expect(r.blocking).toHaveLength(0)
  })

  it('permits compliant dye copy', () => {
    const r = scanText(
      'Mimosa Hostilis root bark is prized by natural dyers for its deep purple pigment and high tannin content. Sold as a raw material for dyeing and soap making.',
      { productLines: ['MIMOSA_HOSTILIS'] },
    )
    expect(r.clean).toBe(true)
  })
})

describe('lexicon — sitewide health claims', () => {
  it('blocks disease and therapeutic claims regardless of product line', () => {
    const r = scanText('This will treat your anxiety and cure insomnia.')
    expect(r.clean).toBe(false)
    expect(r.blocking.map((m) => m.term)).toEqual(
      expect.arrayContaining(['treat', 'anxiety', 'cure', 'insomnia']),
    )
  })

  it('blocks the exact phrasing a market leader uses', () => {
    // Verbatim from a competitor category page — see STEP-01 teardown §2.1.
    const r = scanText(
      'Incredible euphoria, relaxation and peace of mind from alkaloids that cause various beneficial effects.',
    )
    expect(r.blocking.map((m) => m.term)).toEqual(
      expect.arrayContaining(['euphoria', 'beneficial effects']),
    )
  })

  it('blocks soft structure/function claims that read as harmless', () => {
    expect(scanText('Promotes sleep naturally.').clean).toBe(false)
    expect(scanText('Real health benefits.').clean).toBe(false)
  })

  it('blocks conflation with psilocybin', () => {
    const r = scanText('Our magic mushroom gummies contain psilocybin.')
    expect(r.blocking.map((m) => m.term)).toEqual(
      expect.arrayContaining(['magic mushroom', 'psilocybin']),
    )
  })
})

describe('lexicon — word-boundary precision', () => {
  it('does not flag "health" as "heal"', () => {
    expect(scanText('Health and Safety information.').blocking).toHaveLength(0)
  })

  it('does not flag "secure" as "cure"', () => {
    expect(scanText('Your order is secure.').blocking).toHaveLength(0)
  })

  it('does not flag "highlight" as "high"', () => {
    expect(scanText('We highlight every batch result.').warnings).toHaveLength(0)
  })

  it('does flag the standalone word', () => {
    expect(scanText('It will heal you.').blocking).toHaveLength(1)
  })

  it('matches case-insensitively', () => {
    expect(scanText('It will CURE you.').blocking).toHaveLength(1)
  })

  it('matches multi-word terms across variable whitespace', () => {
    expect(scanText('FDA    approved product.').blocking.length).toBeGreaterThan(0)
  })
})

describe('lexicon — allow directives', () => {
  it('parses a directive that names terms and gives a reason', () => {
    expect(
      parseAllowDirectives('<!-- compliance-allow: extract, consumption -- quoting FDA -->'),
    ).toEqual(['extract', 'consumption'])
  })

  it('ignores a directive with no reason, so the hatch cannot be used silently', () => {
    expect(parseAllowDirectives('<!-- compliance-allow: extract -->')).toEqual([])
  })

  it('lets a legality page quote the FDA statement verbatim', () => {
    const page = `<!-- compliance-allow: extract, consumption -- quoting the FDA December 2024 statement and the Louisiana statute -->
The FDA stated that Amanita muscaria, its extract and certain constituents are not
authorized for use in conventional food. Louisiana prohibits it for human consumption.`
    const r = scanText(page, { productLines: ['AMANITA'] })
    expect(r.clean).toBe(true)
    expect(r.allowedTerms).toContain('extract')
  })
})

describe('lexicon — review moderation', () => {
  it('flags a customer review making a cure claim', () => {
    const r = scanReview('This completely cured my depression, better than any medicine.')
    expect(r.clean).toBe(false)
    expect(r.blocking.map((m) => m.term)).toEqual(
      expect.arrayContaining(['depression', 'medicine']),
    )
  })

  it('passes an honest review about the product itself', () => {
    const r = scanReview('Fast shipping, well packaged, and the batch COA matched the label.')
    expect(r.clean).toBe(true)
  })
})

describe('lexicon — reporting', () => {
  it('reports accurate line numbers', () => {
    const r = scanText('line one\nline two\nthis will cure you')
    expect(r.blocking[0]?.line).toBe(3)
  })

  it('returns an excerpt for the author to locate the match', () => {
    const r = scanText('Some copy that will cure everything you have.')
    expect(r.blocking[0]?.excerpt).toContain('cure')
  })

  it('suppresses warnings when asked', () => {
    const copy = 'Serving dosage as printed on the label.'
    const withWarn = scanText(copy, { includeWarnings: true })
    const without = scanText(copy, { includeWarnings: false })
    expect(withWarn.warnings.length).toBeGreaterThan(0)
    expect(without.warnings).toHaveLength(0)
  })
})

describe('lexicon — safe phrases (mandated compliance language)', () => {
  it('does not flag our own required not-for-human-consumption disclaimer', () => {
    const r = scanText(
      'This is a raw botanical material. It is not food, and it is not sold for human consumption.',
      { productLines: ['MIMOSA_HOSTILIS'] },
    )
    expect(r.clean).toBe(true)
  })

  it('does not flag the FDA disclaimer we are required to display', () => {
    const r = scanText(
      'These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, mitigate, or prevent any disease or condition.',
    )
    expect(r.clean).toBe(true)
  })

  it('does not flag neutral "high tannin content" product copy', () => {
    expect(scanText('Prized for its high tannin content.').matches).toHaveLength(0)
  })

  it('still flags "consumption" when it is NOT part of a safe phrase', () => {
    const r = scanText('Grind the bark before consumption.', {
      productLines: ['MIMOSA_HOSTILIS'],
    })
    expect(r.clean).toBe(false)
  })

  it('keeps line numbers accurate after masking', () => {
    const text = 'It is not sold for human consumption.\nline two\nthis will cure you'
    expect(scanText(text).blocking[0]?.line).toBe(3)
  })
})

describe('lexicon precision — narrow rules beat broad ones', () => {
  it('blocks the actual risky phrasing', () => {
    for (const copy of [
      'Will this get you high?',
      'It gets you high.',
      'You will feel high.',
    ]) {
      expect(scanText(copy).clean, copy).toBe(false)
    }
  })

  it('does not fire on legitimate uses of the word "high"', () => {
    // A bare "high" rule was tried and removed: it flagged all of these, so authors
    // learned to override it. A rule that is routinely overridden is worse than none.
    for (const copy of [
      'Prized for its high tannin content.',
      'Sort by price: low to high.',
      'High quality, US-packed.',
      'Highest rated first.',
    ]) {
      expect(scanText(copy).matches, copy).toHaveLength(0)
    }
  })
})

describe('lexicon — externally supplied allow terms', () => {
  it('honours terms passed in by the caller', () => {
    const copy = 'Amanita muscaria does not contain psilocybin.'
    expect(scanText(copy).clean).toBe(false)
    expect(scanText(copy, { extraAllowedTerms: ['psilocybin'] }).clean).toBe(true)
  })

  it('is case-insensitive about supplied terms', () => {
    expect(
      scanText('It does not contain Psilocybin.', { extraAllowedTerms: ['PSILOCYBIN'] }).clean,
    ).toBe(true)
  })
})

describe('lexicon — disclaiming a claim is not making one', () => {
  it('permits our canonical no-claims disclaimer', () => {
    expect(
      scanText('We make no health, medical or therapeutic claims about any product.').clean,
    ).toBe(true)
  })

  it('still blocks an actual therapeutic claim', () => {
    expect(scanText('Therapeutic benefits in every serving.').clean).toBe(false)
  })
})

describe('controlled substances (sitewide)', () => {
  it.each([
    'Blotter art inspired by LSD.',
    'Classic lysergic vibes.',
    'Better than acid tabs.',
    'Pairs with MDMA.',
    'Contains mescaline.',
    'Wild peyote harvest.',
    'Like ketamine, but legal.',
    'Psilocybe cubensis spores.',
    'Not your usual magic mushrooms.',
    'Naturally rich in DMT.',
  ])('blocks %j on every product line', (copy) => {
    for (const line of ['AMANITA', 'VAPE', 'MIMOSA_HOSTILIS'] as const) {
      expect(scanText(copy, { productLines: [line] }).clean).toBe(false)
    }
  })

  it('catches analogue names that carry the base name, such as 1P-LSD', () => {
    expect(scanText('Now stocking 1P-LSD.').clean).toBe(false)
  })

  it('does not fire inside unrelated words', () => {
    expect(scanText('Our HLSD-rated packaging and a ketaminer brand.').clean).toBe(true)
  })
})

describe('honourDirectives', () => {
  const smuggled =
    '<!-- compliance-allow: cure -- operator says so --> This tincture will cure what ails you.'

  it('obeys a directive in repository copy by default', () => {
    expect(scanText(smuggled).clean).toBe(true)
  })

  it('ignores a directive typed into an admin form', () => {
    const result = scanText(smuggled, { honourDirectives: false })
    expect(result.clean).toBe(false)
    expect(result.blocking.map((m) => m.term)).toContain('cure')
  })
})

/*
  Owner, 2026-09-15: the site could not publish even "we do not sell LSD", because the
  name was blocked everywhere. Writing ABOUT a controlled substance in a guide that
  says plainly it is not sold is now allowed; naming one anywhere the shop sells is
  blocked exactly as before.
*/
describe('controlled substances: written about, never offered', () => {
  const guide = 'Is LSD legal in Texas? No: LSD is a Schedule I substance, and we do not sell LSD or anything that contains it.'

  it('lets a guide that says it is not sold name it, as a warning the author still sees', () => {
    const result = scanText(guide, { editorial: true, honourDirectives: false })
    expect(result.clean).toBe(true)
    expect(result.warnings.map((m) => m.term)).toContain('LSD')
  })

  it('still blocks it in a guide that does not say it is not sold', () => {
    const result = scanText('Is LSD legal in Texas? It is a Schedule I substance.', { editorial: true })
    expect(result.clean).toBe(false)
    expect(result.blocking.map((m) => m.term)).toContain('LSD')
  })

  it('still blocks it on every selling surface, disclaimer or not', () => {
    for (const copy of ['LSD tabs, 100ug', guide]) {
      const result = scanText(copy, { productLines: ['VAPE'], honourDirectives: false })
      expect(result.clean, copy).toBe(false)
    }
  })

  it('never softens a health claim, even in a disclaimed guide', () => {
    const result = scanText(`${guide} Amanita can cure anxiety.`, { editorial: true, productLines: ['AMANITA'] })
    expect(result.clean).toBe(false)
    expect(result.blocking.map((m) => m.term.toLowerCase())).toEqual(expect.arrayContaining(['cure']))
  })

  it('accepts the common ways of saying it, including a curly apostrophe', () => {
    for (const line of ['We don’t sell MDMA.', "We don't sell ketamine.", 'Mescaline is not sold here.', 'We do not stock DMT.']) {
      expect(scanText(`A note on the law. ${line}`, { editorial: true }).clean, line).toBe(true)
    }
    expect(hasNotSoldDisclaimer('WE DO NOT\n  SELL it')).toBe(true)
    expect(hasNotSoldDisclaimer('we sell it')).toBe(false)
  })

  it('hides the softened term from a scan that asked for blocks only', () => {
    const result = scanText(guide, { editorial: true, includeWarnings: false })
    expect(result.matches).toHaveLength(0)
    expect(result.clean).toBe(true)
  })
})
