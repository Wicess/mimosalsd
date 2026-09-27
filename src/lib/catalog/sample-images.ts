import type { ProductImage } from './types'
/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  SAMPLE PRODUCT IMAGERY — PLACEHOLDERS. NOT PHOTOGRAPHS OF WHAT WE SELL.
 *
 *  The site shipped with no imagery at all, which cost it three things at once:
 *  `image` is the field Google most wants on a Product node for a merchant rich
 *  result, Google Images is a live organic channel in this category, and a product
 *  page with no photograph converts badly however well it ranks.
 *
 *  These are openly-licensed stand-ins chosen to show the right KIND of thing — a
 *  milled botanical powder, cut bark, a gummy, a capsule — so the layout, the schema
 *  and the loading behaviour can all be built and measured for real. Every one is
 *  surfaced to the visitor as a sample rather than presented as the product, because
 *  showing stock photography as if it were the goods on a regulated storefront is a
 *  misrepresentation, not a placeholder.
 *
 *  REPLACING THEM is a two-step job and nothing else changes:
 *    1. Upload the real photographs — `npm run images:upload` — under the same file
 *       names. They go to R2 as `products/<id>.jpg` and are live immediately; nothing
 *       is committed to the repository and no deploy is needed.
 *    2. Set IS_PLACEHOLDER to false. The sample badge and this credits list disappear,
 *       and the alt text falls back to the product's own name.
 *
 *  Attribution below is a LICENCE CONDITION for the CC BY and CC BY-SA entries, not a
 *  courtesy. It is rendered on /legal-disclaimer. Do not delete it while these files
 *  are still in use.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Flip to false once real product photography replaces these files. */
export const IS_PLACEHOLDER = true

export interface SampleImage {
  readonly id: string
  /**
   * Path under /public.
   *
   * The FALLBACK, not the source of truth. Product imagery is served from object
   * storage — see `imageSrc()` below — and this path is what a checkout of this
   * repository renders when no CDN host is configured, so the site is never
   * imageless on a fresh clone.
   */
  readonly file: string
  /** Describes what is actually pictured — never what we wish were pictured. */
  readonly alt: string
  /**
   * Square, and that is deliberate. The card and the product page both reserve a 1:1
   * box; a 3:2 source displayed in it left the natural and rendered ratios
   * disagreeing, which Lighthouse flags under `image-aspect-ratio`. Cropping the
   * files square makes the reserved box exactly right and removes the object-fit
   * guesswork — it also took the set from 1.5 MB to under 1 MB.
   */
  readonly width: number
  readonly height: number
  readonly credit: {
    readonly title: string
    readonly author: string
    readonly license: string
    readonly licenseUrl: string
    readonly source: string
  }
}

/**
 * Where a product image is actually served from.
 *
 * R2 first, always, when a public host is configured. Images do not belong in
 * the repository: committed to /public they are baked into every build, served
 * from the application origin rather than the CDN, and cannot be replaced
 * without a deploy — which for a catalogue whose photography is still being shot
 * is the wrong shape entirely. `npm run images:upload` puts a file at
 * `products/<name>`, and this resolves to it.
 *
 * Read at module scope, so the URL is baked into the prerendered HTML at build
 * time and costs nothing per request. It is read from the NEXT_PUBLIC_ alias —
 * `next.config.ts` maps `R2_PUBLIC_HOST` onto it — because this module is
 * imported by the cart drawer, which is a client component, and a bare server
 * variable there resolves to `undefined` in the browser and renders a different
 * image than the server did.
 *
 * NOTE FOR LAUNCH: `R2_PUBLIC_HOST` is currently the `pub-*.r2.dev` development
 * host, which Cloudflare rate-limits and explicitly does not support for
 * production traffic. It must be a custom CDN domain before this site takes
 * real traffic — every product image on every page comes through it.
 */
const CDN_HOST = (
  process.env.NEXT_PUBLIC_R2_PUBLIC_HOST || process.env.R2_PUBLIC_HOST
)
  ?.replace(/^https?:\/\//, '')
  .replace(/\/$/, '')

export function imageSrc(image: SampleImage): string {
  return CDN_HOST ? `https://${CDN_HOST}/products/${image.id}.jpg` : image.file
}

/**
 * How many additional views each sample has in object storage.
 *
 * The convention is `products/<id>.jpg` for the main frame and `-2`, `-3` for
 * further views. It is a COUNT rather than a list because the storage layout is
 * the contract: uploading `products/mhrb-powder-4.jpg` and raising this number is
 * the whole job of adding a fourth angle, with no other file to edit.
 *
 * The current extras are honest derivatives of the licensed frame — a centre
 * detail and a lower crop of the same photograph, not different photographs. They
 * show the same material in the same shot, which is what the "sample image"
 * caption on the page already says.
 */
export const SAMPLE_VIEW_COUNT = 3

/** Every view of a sample, main frame first. */
export function imageSrcSet(image: SampleImage): readonly string[] {
  if (!CDN_HOST) return [image.file]
  return Array.from({ length: SAMPLE_VIEW_COUNT }, (_, i) =>
    i === 0
      ? `https://${CDN_HOST}/products/${image.id}.jpg`
      : `https://${CDN_HOST}/products/${image.id}-${i + 1}.jpg`,
  )
}

export const SAMPLE_IMAGES: Record<string, SampleImage> = {
  'mhrb-powder': {
    id: 'mhrb-powder',
    file: '/samples/mhrb-powder.jpg',
    alt: 'Sample image: a spoonful of finely milled reddish-brown botanical powder beside a small heap of it.',
    width: 1200,
    height: 1200,
    credit: {
      title: 'Ground cinnamon',
      author: 'TheDeliciousLife',
      license: 'CC BY 2.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/2.0',
      source: 'https://commons.wikimedia.org/wiki/File:Ground_cinnamon.jpg',
    },
  },
  'mhrb-shredded': {
    id: 'mhrb-shredded',
    file: '/samples/mhrb-shredded.jpg',
    alt: 'Sample image: rolled quills of dried bark beside a wooden spoon of the same bark milled to a powder.',
    width: 1200,
    height: 1200,
    credit: {
      title: 'Ground Cinnamon Powder and a Cinnamon Stick',
      author: 'formulatehealth',
      license: 'CC BY 2.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/2.0',
      source:
        'https://commons.wikimedia.org/wiki/File:Ground_Cinnamon_Powder_and_a_Cinnamon_Stick.jpg',
    },
  },
  'amanita-caps': {
    id: 'amanita-caps',
    file: '/samples/amanita-caps.jpg',
    alt: 'Sample image: an Amanita muscaria mushroom, its orange-red cap flecked with white, growing in moss.',
    width: 1200,
    height: 1200,
    credit: {
      title: 'AD2009Sep20 Amanita muscaria 02',
      author: 'Bernie',
      license: 'Public domain',
      licenseUrl: 'https://commons.wikimedia.org/wiki/Help:Public_domain',
      source:
        'https://commons.wikimedia.org/wiki/File:AD2009Sep20_Amanita_muscaria_02.jpg',
    },
  },
  'amanita-powder': {
    id: 'amanita-powder',
    file: '/samples/amanita-powder.jpg',
    alt: 'Sample image: dried mushroom milled to a fine pale powder in a grinder bowl.',
    width: 1200,
    height: 1200,
    credit: {
      title: 'Mushroom powder, Boletus edulis, dried and freshly ground',
      author: 'Alex Ex',
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
      source:
        'https://commons.wikimedia.org/wiki/File:Mushroom_powder,_Boletus_edulis,_dried_and_freshly_ground.jpg',
    },
  },
  'amanita-gummies': {
    id: 'amanita-gummies',
    file: '/samples/amanita-gummies.jpg',
    alt: 'Sample image: a single round amber gummy rolled in sugar, photographed on a white surface.',
    width: 1200,
    height: 1200,
    credit: {
      title: 'Karl Gummies top view',
      author: 'Johnson524',
      license: 'CC0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      source: 'https://commons.wikimedia.org/wiki/File:Karl_Gummies_top_view.jpg',
    },
  },
  'amanita-capsules': {
    id: 'amanita-capsules',
    file: '/samples/amanita-capsules.jpg',
    alt: 'Sample image: a small pile of translucent amber softgel capsules on a white surface.',
    width: 1200,
    height: 1200,
    credit: {
      title: 'DHA pills',
      author: 'Mx. Granger',
      license: 'CC0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      source: 'https://commons.wikimedia.org/wiki/File:DHA_pills.jpg',
    },
  },
  'disposable-vape': {
    id: 'disposable-vape',
    file: '/samples/disposable-vape.jpg',
    alt: 'Sample image: a small unbranded cylindrical disposable vapor device.',
    width: 1200,
    height: 1200,
    credit: {
      title: 'Disposable electronic cigarette copper tube',
      author: 'Fumikas Sagisavas',
      license: 'CC0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      source:
        'https://commons.wikimedia.org/wiki/File:Disposable_electronic_cigarette_copper_tube.jpg',
    },
  },
}

/**
 * Slug prefix → sample, LONGEST PREFIX FIRST.
 *
 * Order is load-bearing: `amanita-caps` is a prefix of `amanita-capsules`, so a
 * shortest-first scan would hand every capsule product the whole-mushroom photo.
 * `sampleImageFor` sorts by length rather than relying on the order written here, and
 * a test asserts every catalog product resolves — so a new SKU cannot silently render
 * with no image.
 */
const PREFIX_RULES: ReadonlyArray<readonly [string, string]> = [
  ['amanita-capsules', 'amanita-capsules'],
  ['amanita-gummies', 'amanita-gummies'],
  ['amanita-powder', 'amanita-powder'],
  ['amanita-caps', 'amanita-caps'],
  ['mhrb-shredded', 'mhrb-shredded'],
  ['mhrb-powder', 'mhrb-powder'],
  ['disposable-vape', 'disposable-vape'],
]

export function sampleImageFor(productSlug: string): SampleImage | undefined {
  const match = [...PREFIX_RULES]
    .sort((a, b) => b[0].length - a[0].length)
    .find(([prefix]) => productSlug.startsWith(prefix))
  return match ? SAMPLE_IMAGES[match[1]] : undefined
}

/** Credits actually in use, de-duplicated, for the attribution list. */
/**
 * The stand-in for the proprietor plate.
 *
 * Material, not a face. The alternative was a stock portrait of a real person
 * standing in for a founder they have never met, on the homepage of a business
 * selling age-restricted goods — that borrows a stranger's likeness for a claim
 * about who runs this company, and a caption underneath does not undo it.
 *
 * This is the bark the business is built on, already licensed and already in
 * object storage. It fills the plate honestly, and the moment a real portrait
 * lands in `BRAND.proprietor.portrait` it takes over.
 */
/**
 * What a product page, card or cart line shows: the product's own photograph when
 * an operator uploaded one in the admin panel, otherwise the openly licensed sample
 * for its kind.
 *
 * `isSample` travels with the image instead of being read from the sitewide flag.
 * A posted product's photograph IS the product, and captioning it "Sample image"
 * would be a false statement on a site whose argument is that claims can be checked.
 */
export interface DisplayImage {
  readonly src: string
  readonly srcSet: readonly string[]
  readonly alt: string
  /** One description per view, in order. */
  readonly alts: readonly string[]
  readonly isSample: boolean
}

export function displayImageFor(product: {
  readonly slug: string
  readonly images: readonly ProductImage[]
}): DisplayImage | undefined {
  // Only uploads live under media/. Authored products carry products/ keys that
  // were never uploaded, which is why they have always shown the samples.
  const uploaded = product.images.filter((i) => i.objectKey.startsWith('media/'))
  if (uploaded.length > 0 && CDN_HOST) {
    const urls = uploaded.map((i) => `https://${CDN_HOST}/${i.objectKey}`)
    return { src: urls[0]!, srcSet: urls, alt: uploaded[0]!.alt, alts: uploaded.map((i) => i.alt), isSample: false }
  }
  const sample = sampleImageFor(product.slug)
  if (!sample) return undefined
  return {
    src: imageSrc(sample),
    srcSet: imageSrcSet(sample),
    alt: sample.alt,
    alts: imageSrcSet(sample).map(() => sample.alt),
    isSample: IS_PLACEHOLDER,
  }
}

export const PROPRIETOR_SAMPLE = SAMPLE_IMAGES['mhrb-shredded']

export function imageCredits(): readonly SampleImage['credit'][] {
  const seen = new Set<string>()
  return Object.values(SAMPLE_IMAGES).filter((image) => {
    if (seen.has(image.credit.source)) return false
    seen.add(image.credit.source)
    return true
  }).map((image) => image.credit)
}
