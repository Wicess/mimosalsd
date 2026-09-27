import type { Product } from '@/lib/catalog/types'
import { RichText } from '@/components/content/rich-text'
import type { ProductLine } from '@/lib/compliance/types'

/**
 * The write-up, in named sections.
 *
 * It was one heading — "About this product" — over three or four unlabelled
 * paragraphs in a half-width column. A reader looking for one specific thing had
 * to read all of it to find out whether it was there, and a crawler saw a block
 * of prose with no structure to lift.
 *
 * The paragraphs already have a shape: what the thing is, how it behaves in use,
 * what it is not. Naming those turns the same words into something scannable and
 * something an answer engine can quote a section of. The headings come from the
 * PRODUCT LINE rather than being written per product, so a new SKU in an existing
 * line is captioned correctly the day it is added.
 *
 * A paragraph with no heading left over still renders — the copy is the source of
 * truth here, not this map, and a mismatch must never silently drop a sentence
 * that the catalogue says belongs on the page.
 *
 * ── Where the band went ─────────────────────────────────────────────────────
 * This used to draw its own rule and tinted panel. It no longer does: the page
 * wraps it in a `PageSection`, which spans the full viewport instead of sitting
 * as a rounded card inside the content column. A panel inside a band is a box
 * inside a box, and the site now separates every section the same way the
 * homepage always did.
 *
 * What stays is the typography, which is what the band was really for.
 * Three typefaces, each doing one job. The serif names the section, Space Grotesk
 * (`font-product`) labels each part, and Inter carries the prose. The labels are
 * ruled underneath like a datasheet, which is the right register for a page
 * describing a raw material by weight, and it is a real structural device rather
 * than decoration — you can find the part you came for without reading the rest.
 */
const SECTIONS: Record<ProductLine, readonly string[]> = {
  MIMOSA_HOSTILIS: [
    'What this material is',
    'How it behaves in a dye bath',
    'Sizes and storage',
    'What it is not',
  ],
  AMANITA: [
    'What this is',
    'How every batch is tested',
    'Where it can be sent',
  ],
  VAPE: [
    'What this is',
    'How it reaches you',
    'Before you order',
  ],
}

export function ProductStory({ product }: { product: Product }) {
  if (product.content?.sections.length) return <WrittenStory product={product} />
  const paragraphs = product.description.split('\n\n').filter(Boolean)
  const headings = SECTIONS[product.productLine]

  return (
    <div>
        <h2
          id="product-story"
          className="font-display text-3xl leading-tight text-balance text-foreground"
        >
          About {product.name}
        </h2>
        {/* The same accent mark the page headers use, so this reads as one system. */}
        <div aria-hidden className="mt-4 h-0.5 w-10 rounded-full bg-accent" />

        {/*
          Two columns of sections on a wide screen, not two columns of prose.

          A paragraph split across a column break is unreadable; a SECTION in each
          column is a magazine. Each section stays whole and the pair fills the
          width the page has, which is the point.
        */}
        <div className="mt-9 grid gap-x-14 gap-y-9 md:grid-cols-2">
          {paragraphs.map((para, i) => (
            <div key={para.slice(0, 40)} className="max-w-[68ch]">
              {headings[i] && (
                <h3 className="font-product border-b border-border-data pb-2 text-base leading-snug font-semibold tracking-[-0.01em] text-balance text-foreground">
                  {headings[i]}
                </h3>
              )}
              <p className="mt-3.5 leading-relaxed text-pretty text-foreground-muted">
                {para}
              </p>
            </div>
          ))}
        </div>
    </div>
  )
}

/**
 * A page from the automatic writer: its own section headings, its links, the reasons
 * to buy it here, and the outside sources it relied on. Same typography as the
 * authored story, so the two read as one site.
 */
function WrittenStory({ product }: { product: Product }) {
  const content = product.content!
  return (
    <div>
      <h2 id="product-story" className="font-display text-3xl leading-tight text-balance text-foreground">
        About {product.name}
      </h2>
      <div aria-hidden className="mt-4 h-0.5 w-10 rounded-full bg-accent" />

      <div className="mt-9 grid gap-x-14 gap-y-9 md:grid-cols-2">
        {content.sections.map((section) => (
          <section key={section.heading} className="max-w-[68ch]">
            <h3 className="font-product border-b border-border-data pb-2 text-base leading-snug font-semibold tracking-[-0.01em] text-balance text-foreground">
              {section.heading}
            </h3>
            {section.paragraphs.map((paragraph, i) => (
              <p key={i} className="mt-3.5 leading-relaxed text-pretty text-foreground-muted">
                <RichText text={paragraph} />
              </p>
            ))}
          </section>
        ))}
      </div>

      {content.advantages.length ? (
        <section className="mt-10 max-w-3xl">
          <h3 className="font-product border-b border-border-data pb-2 text-base font-semibold text-foreground">
            Why buy {product.name} here
          </h3>
          <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
            {content.advantages.map((advantage) => (
              <li key={advantage} className="flex gap-2.5 text-sm leading-relaxed text-foreground-muted">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
                {advantage}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {content.sources.length ? (
        <section className="mt-10 max-w-3xl" aria-labelledby="product-sources">
          <h3 id="product-sources" className="font-product border-b border-border-data pb-2 text-base font-semibold text-foreground">
            Sources
          </h3>
          <ol className="mt-4 list-decimal space-y-1.5 pl-5 text-sm text-foreground-muted">
            {content.sources.map((source) => (
              <li key={source.url}>
                <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4 hover:text-foreground">
                  {source.label}
                </a>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  )
}
