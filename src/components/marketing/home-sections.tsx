import Image from 'next/image'
import { heroAlt, heroSrc, isHeroKey } from '@/lib/content/hero-image'
import { url } from '@/lib/seo/routes'
import type { Post } from '@/lib/content/content.data'

/*
  The two home-page sections the owner kept from the 2026-09-29 redesign when the
  rest of the page went back to the sibling build's (2026-10-01): the article
  feature and the bulk band. Server components: nothing here needs JavaScript.
*/

/** A section heading with its lede: one shape, so every section reads as one site. */
function Heading({ id, kicker, title, lede, align = 'left' }: { id: string; kicker?: string; title: string; lede?: string; align?: 'left' | 'center' }) {
  return (
    <div className={align === 'center' ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'}>
      {kicker && <p className="text-sm font-medium text-accent-fg">{kicker}</p>}
      <h2 id={id} className="mt-2 font-display text-3xl leading-[1.1] font-medium tracking-[-0.02em] text-balance text-foreground md:text-[2.75rem]">
        {title}
      </h2>
      {lede && <p className="mt-4 text-base leading-relaxed text-pretty text-foreground-muted md:text-lg">{lede}</p>}
    </div>
  )
}

// ── Articles: one featured, two beside it ───────────────────────────────────

function cover(post: Post): { src: string; alt: string } | undefined {
  const src = post.heroImageKey && isHeroKey(post.heroImageKey) ? heroSrc(post.heroImageKey) : undefined
  return src ? { src, alt: heroAlt(post.title) } : undefined
}

export function ArticleFeature({ articles }: { articles: readonly Post[] }) {
  const [lead, ...rest] = articles
  if (!lead) return null
  const leadCover = cover(lead)
  return (
    <section aria-labelledby="home-articles" className="border-y border-border bg-surface py-16 md:py-24">
      <div className="shell">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <Heading id="home-articles" kicker="From the dye studio" title="Dyeing with root bark: start here." />
          <a href={url.blog()} className="inline-flex min-h-11 items-center text-sm text-primary underline underline-offset-4">
            All guides and articles
          </a>
        </div>
        <div className="mt-10 grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <a href={url.blogPost(lead.slug)} className="group relative flex min-h-[22rem] flex-col justify-end overflow-hidden rounded-2xl bg-surface-sunken md:min-h-[28rem]">
            {leadCover && (
              <Image src={leadCover.src} alt={leadCover.alt} fill sizes="(max-width: 1023px) 100vw, 58vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.03] motion-reduce:transition-none" />
            )}
            <span aria-hidden className="absolute inset-0 bg-linear-to-t from-stone-950/95 via-stone-950/50 to-transparent" />
            <span className="relative p-6 text-white md:p-8">
              <span className="text-xs font-medium text-white/70">Featured guide</span>
              <span className="mt-2 block font-display text-2xl leading-tight font-medium text-balance md:text-3xl">{lead.title}</span>
              <span className="mt-3 block max-w-xl text-sm leading-relaxed text-white/85 line-clamp-3">{lead.summary}</span>
            </span>
          </a>
          <div className="grid gap-5">
            {rest.map((post) => {
              const c = cover(post)
              return (
                <a key={post.slug} href={url.blogPost(post.slug)} className="group grid grid-cols-[7rem_minmax(0,1fr)] gap-4 rounded-2xl border border-border bg-background p-3 transition-colors hover:border-border-strong md:grid-cols-[9rem_minmax(0,1fr)]">
                  <span className="relative block aspect-square overflow-hidden rounded-xl bg-surface-sunken">
                    {c && <Image src={c.src} alt={c.alt} fill sizes="9rem" className="object-cover" />}
                  </span>
                  <span className="self-center py-1 pr-2">
                    <span className="block font-display text-lg leading-snug font-medium text-foreground">{post.title}</span>
                    <span className="mt-1.5 block text-[13px] leading-snug text-foreground-muted line-clamp-3">{post.summary}</span>
                  </span>
                </a>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Bulk: the size ladder ───────────────────────────────────────────────────

const LADDER = [
  { size: '1/4 lb', note: 'Test skeins', h: 'h-8' },
  { size: '1/3 lb', note: 'A few skeins', h: 'h-11' },
  { size: '1/2 lb', note: 'A sweater lot', h: 'h-16' },
  { size: '1 lb', note: 'One to two pounds of wool', h: 'h-24' },
  { size: 'Bulk', note: 'By the case, quoted', h: 'h-36' },
] as const

export function BulkBand() {
  return (
    <section aria-labelledby="home-bulk" className="border-y border-border bg-surface-sunken py-16 md:py-20">
      <div className="shell grid gap-10 md:grid-cols-2 md:items-end">
        <div>
          <Heading
            id="home-bulk"
            kicker="Buying in volume"
            title="From a quarter pound to the whole studio."
            lede="Dye studios, soap makers, schools and resellers buy by the case. Tell us the cut and the quantity, and a person replies with a quote, usually the same day."
          />
          <a
            href={url.bulk()}
            className="mt-7 inline-flex min-h-12 items-center gap-3 rounded-full bg-accent py-2 pr-2 pl-6 text-base font-medium text-on-accent transition-transform duration-300 active:scale-[0.98]"
          >
            Request a bulk quote
            <span aria-hidden className="flex size-8 items-center justify-center rounded-full bg-black/10">&rarr;</span>
          </a>
        </div>
        <ol className="flex items-end gap-2 md:gap-3" aria-label="Sizes, from a quarter pound to bulk">
          {LADDER.map((rung, i) => (
            <li key={rung.size} className="flex flex-1 flex-col">
              <span
                aria-hidden
                className={`${rung.h} rounded-t-lg ${i === LADDER.length - 1 ? 'bg-accent' : 'bg-primary/35'}`}
              />
              <span className="mt-3 font-display text-lg font-medium text-foreground">{rung.size}</span>
              <span className="text-[12px] leading-snug text-foreground-muted">{rung.note}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
