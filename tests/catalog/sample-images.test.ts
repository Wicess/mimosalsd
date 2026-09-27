import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { catalog } from '@/lib/catalog/repository'
import {
  imageCredits,
  SAMPLE_IMAGES,
  sampleImageFor,
} from '@/lib/catalog/sample-images'

const PUBLIC_DIR = join(process.cwd(), 'public')

describe('every product resolves to an image', () => {
  it.each(catalog.listProducts().map((p) => [p.slug] as const))(
    '%s has a sample image',
    (slug) => {
      expect(sampleImageFor(slug), `no sample image for ${slug}`).toBeDefined()
    },
  )

  /**
   * `amanita-caps` is a prefix of `amanita-capsules`. A shortest-prefix-first scan
   * would give every capsule product the whole-mushroom photograph, which is the kind
   * of wrong that looks fine in a grid and is only caught by someone opening the page.
   */
  it('prefers the longest matching prefix', () => {
    expect(sampleImageFor('amanita-capsules')?.id).toBe('amanita-capsules')
    expect(sampleImageFor('amanita-caps-whole-dried')?.id).toBe('amanita-caps')
  })

  it('returns nothing for a slug it does not know', () => {
    expect(sampleImageFor('something-we-do-not-sell')).toBeUndefined()
  })
})

describe('the image files themselves', () => {
  it.each(Object.values(SAMPLE_IMAGES).map((i) => [i.id, i.file] as const))(
    '%s exists on disk at %s',
    (_id, file) => {
      expect(existsSync(join(PUBLIC_DIR, file))).toBe(true)
    },
  )

  /**
   * These sit on the LCP path of the product page. An unoptimised multi-megabyte
   * source would undo the 60 KB the font fix just recovered.
   */
  it.each(Object.values(SAMPLE_IMAGES).map((i) => [i.id, i.file] as const))(
    '%s is small enough to sit on the LCP path',
    (_id, file) => {
      const bytes = statSync(join(PUBLIC_DIR, file)).size
      expect(bytes, `${file} is ${Math.round(bytes / 1024)}kb`).toBeLessThan(400 * 1024)
    },
  )

  it('declares real dimensions, so the reserved box matches the file', () => {
    for (const image of Object.values(SAMPLE_IMAGES)) {
      expect(image.width, image.id).toBeGreaterThan(0)
      expect(image.height, image.id).toBeGreaterThan(0)
    }
  })
})

/**
 * Attribution is a licence condition for the CC BY and CC BY-SA entries. If this ever
 * goes missing while the files are still in use, the site is out of compliance with
 * the licence it is relying on.
 */
describe('attribution', () => {
  it('gives every sample an author, a licence and a source', () => {
    for (const image of Object.values(SAMPLE_IMAGES)) {
      expect(image.credit.author, image.id).not.toBe('')
      expect(image.credit.license, image.id).not.toBe('')
      expect(image.credit.source, image.id).toMatch(/^https:\/\//)
      expect(image.credit.licenseUrl, image.id).toMatch(/^https?:\/\//)
    }
  })

  it('lists a credit for every distinct file in use', () => {
    const distinctSources = new Set(
      Object.values(SAMPLE_IMAGES).map((i) => i.credit.source),
    )
    expect(imageCredits()).toHaveLength(distinctSources.size)
  })

  it('describes what is pictured, and says it is a sample', () => {
    for (const image of Object.values(SAMPLE_IMAGES)) {
      expect(image.alt, image.id).toMatch(/^Sample image:/)
      expect(image.alt.length, image.id).toBeGreaterThan(40)
    }
  })
})
