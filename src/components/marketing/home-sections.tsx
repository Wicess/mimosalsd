import Image from 'next/image'
import { FAQ_ITEMS } from '@/lib/content/faq'
import { heroAlt, heroSrc, isHeroKey } from '@/lib/content/hero-image'
import { dyeSwatch } from '@/lib/design/tokens'
import { url } from '@/lib/seo/routes'
import { BRAND } from '@/lib/brand'
import type { Post } from '@/lib/content/content.data'

/*
  The home page's sections below the hero, each with its own shape (owner,
  2026-09-29: "give each section a unique design, and more content"). Server
  components throughout: nothing here needs JavaScript in the browser, and the
  question list uses <details> so it opens without any.
*/

const CDN = `https://${process.env.NEXT_PUBLIC_R2_PUBLIC_HOST}`

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

// ── Which cut: photograph-led panels ─────────────────────────────────────────

const CUTS = [
  {
    name: 'Shredded',
    href: '/product/shredded-mimosa-hostilis-root-bark',
    photo: `${CDN}/media/13e51ff90939ef04b0db2d7956e35fc9.jpg`,
    alt: 'Shredded Mimosa hostilis root bark, a loose pile of fine reddish-brown fibers',
    line: 'The everyday dyeing cut',
    detail: 'Strains cleanly, builds color steadily, and gives a second and third bath from the same bark.',
    best: 'Wool and silk dye lots, whole fleeces, leather',
  },
  {
    name: 'Powder',
    href: '/product/mimosa-hostilis-root-bark-powder',
    photo: `${CDN}/media/a64732c428b33fdadc00cbf8433e1e8d.jpg`,
    alt: 'A cone of mauve Mimosa hostilis root bark powder in a dark ceramic dish',
    line: 'The fastest color',
    detail: 'Milled fine, so the bath is ready in a fraction of the time. Settle or strain it before the fiber goes in.',
    best: 'Test skeins, small batches, cold-process soap',
  },
  {
    name: 'Whole',
    href: '/product/whole-mimosa-hostilis-root-bark',
    photo: `${CDN}/media/7a5f77fc5187e4717ac3854bf185d9a5.jpg`,
    alt: 'Whole Mimosa hostilis root bark in thick chips, dark outer bark over a red-brown inner face',
    line: 'Keeps the longest',
    detail: 'Chips and strips as they come off the root. Soak overnight, break by hand, or mill a portion when a job needs powder.',
    best: 'Stocking up, slow leather soaks, milling your own',
  },
] as const

export function CutsShowcase() {
  return (
    <section aria-labelledby="home-cuts" className="bg-background py-16 md:py-24">
      <div className="shell">
        <Heading
          id="home-cuts"
          kicker="Choosing a cut"
          title="Three cuts of the same bark. Pick by the job, not the price."
          lede="Every cut dyes the same colors. What changes is how fast the color comes out, how easily the bath strains, and how long the bark keeps."
        />
        <ul className="mt-10 grid gap-4 md:grid-cols-3 md:gap-5">
          {CUTS.map((cut) => (
            <li key={cut.name}>
              <a href={cut.href} className="group relative flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-2xl bg-surface-sunken md:aspect-[3/4]">
                <Image
                  src={cut.photo}
                  alt={cut.alt}
                  fill
                  sizes="(max-width: 767px) 100vw, 33vw"
                  className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04] motion-reduce:transition-none"
                />
                <span aria-hidden className="absolute inset-0 bg-linear-to-t from-stone-950 via-stone-950/55 to-transparent" />
                <span className="relative p-6 text-white">
                  <span className="block text-sm text-white/75">{cut.line}</span>
                  <span className="mt-1 block font-display text-4xl font-medium tracking-[-0.02em]">{cut.name}</span>
                  <span className="mt-3 block text-sm leading-relaxed text-white/85">{cut.detail}</span>
                  <span className="mt-4 block border-t border-white/15 pt-3 text-xs text-white/70">
                    Best for: <span className="text-white">{cut.best}</span>
                  </span>
                  <span className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[color:var(--accent)]">
                    Shop {cut.name.toLowerCase()} bark
                    <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1 motion-reduce:transition-none">&rarr;</span>
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

// ── The colour range: swatches ──────────────────────────────────────────────

const SWATCHES = [
  { name: 'Rose', color: dyeSwatch.rose, how: 'A second or third bath from the same bark, on alum-mordanted wool.' },
  { name: 'Plum', color: dyeSwatch.plum, how: 'A first bath at 50 to 75 percent of the fiber weight, kept neutral to slightly acidic.' },
  { name: 'Burgundy', color: dyeSwatch.burgundy, how: 'Up to an equal weight of bark and fiber, and a long, gentle simmer.' },
  { name: 'Chocolate', color: dyeSwatch.chocolate, how: 'Alkaline water or a hotter bath pulls the purples toward brown.' },
  { name: 'Slate', color: dyeSwatch.slate, how: 'A plum bath followed by a brief dip in a weak iron afterbath.' },
  { name: 'Charcoal', color: dyeSwatch.charcoal, how: 'A deep bath and a stronger iron afterbath: the most lightfast shade.' },
] as const

export function ColourRange() {
  return (
    <section aria-labelledby="home-colours" className="border-y border-border bg-surface-sunken py-16 md:py-24">
      <div className="shell">
        <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:items-end">
          <Heading
            id="home-colours"
            kicker="The color range"
            title="One bark, six shades."
            lede="Mimosa hostilis is rich in tannins and red-purple pigments. How much you use, your water, and a touch of iron decide where on this range a skein lands."
          />
          <p className="text-sm leading-relaxed text-foreground-muted md:pb-2">
            Approximate shades on wool. Your water, your fiber and your mordant all move the result, so
            test a small skein first. For the ratios behind each shade, read{' '}
            <a href={url.blogPost('weighing-bark-against-fibre')} className="text-primary underline underline-offset-4">
              how much bark per pound of fiber
            </a>
            .
          </p>
        </div>
        <ul className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-3 lg:grid-cols-6">
          {SWATCHES.map((s) => (
            <li key={s.name} className="flex flex-col bg-surface">
              <span aria-hidden className="block h-28 md:h-40" style={{ backgroundColor: s.color }} />
              <span className="flex flex-1 flex-col p-4">
                <span className="font-display text-xl font-medium text-foreground">{s.name}</span>
                <span className="mt-1.5 text-[13px] leading-snug text-foreground-muted">{s.how}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

// ── How buying works: a real sequence, so numbered ──────────────────────────

const STEPS = [
  { title: 'Choose a cut and a size', body: 'Every cut comes in 1/4, 1/3, 1/2 and 1 lb. The size you pick sets the price you are quoted.' },
  { title: 'Place your order', body: 'Give your delivery address and the way you would like to pay: Cash App, Chime, Apple Cash or Bitcoin.' },
  { title: 'A person confirms it', body: 'We check the stock and the address it is going to, usually the same day.' },
  { title: 'Pay in your order chat', body: 'Payment details for your method arrive in your order chat on this site, and by email.' },
  { title: 'Weighed, sealed, shipped', body: 'Packed in a double-sealed, smell-proof, nitrogen-flushed bag and shipped from California with tracking.' },
] as const

export function BuyingSteps() {
  return (
    <section aria-labelledby="home-steps" className="bg-background py-16 md:py-24">
      <div className="shell">
        <Heading
          id="home-steps"
          align="center"
          kicker="How ordering works"
          title="From your cart to your dye pot in five steps."
          lede={`A person looks at every order. It takes a little longer than a card checkout, and it is how ${BRAND.name} has worked with its customers since ${BRAND.track.foundedYear}.`}
        />
        <ol className="relative mt-12 grid gap-8 md:grid-cols-5 md:gap-4">
          <span aria-hidden className="absolute top-6 right-[10%] left-[10%] hidden h-px bg-border md:block" />
          {STEPS.map((step, i) => (
            <li key={step.title} className="relative flex gap-4 md:flex-col md:items-center md:gap-0 md:text-center">
              <span className="relative flex size-12 shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface font-display text-lg font-medium text-foreground">
                {i + 1}
              </span>
              <span className="md:mt-5">
                <span className="block font-display text-lg font-medium text-foreground">{step.title}</span>
                <span className="mt-1.5 block text-sm leading-relaxed text-foreground-muted">{step.body}</span>
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-10 text-center">
          <a href={url.guide('how-ordering-and-payment-works')} className="inline-flex min-h-11 items-center text-sm text-primary underline underline-offset-4">
            The full ordering guide
          </a>
        </p>
      </div>
    </section>
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

// ── Buyer questions: a sticky intro and an accordion ────────────────────────

const HOME_QUESTIONS = [
  'Should I buy powder, shredded or whole root bark?',
  'How much Mimosa hostilis do I need to dye a pound of wool?',
  'What colors does Mimosa hostilis dye?',
  'When do I pay for my order?',
  'How is the root bark packed?',
] as const

export function BuyerQuestions() {
  const items = HOME_QUESTIONS.map((q) => FAQ_ITEMS.find((i) => i.question === q)).filter((i) => i !== undefined)
  return (
    <section aria-labelledby="home-questions" className="bg-background py-16 md:py-24">
      <div className="shell grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <Heading
            id="home-questions"
            kicker="Before you order"
            title="The questions dyers ask us first."
            lede="Straight answers on cuts, quantities, color, payment and packing. Anything else, ask us in the chat."
          />
          <a href={url.faq()} className="mt-6 inline-flex min-h-11 items-center text-sm text-primary underline underline-offset-4">
            Every question and answer
          </a>
        </div>
        <div className="divide-y divide-border border-y border-border">
          {items.map((item) => (
            <details key={item.question} className="group py-1">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 font-display text-lg font-medium text-foreground [&::-webkit-details-marker]:hidden">
                {item.question}
                <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border text-foreground-muted transition-transform duration-200 group-open:rotate-45 motion-reduce:transition-none">
                  +
                </span>
              </summary>
              <p className="pb-5 text-[15px] leading-relaxed text-pretty text-foreground-muted">{item.answer}</p>
            </details>
          ))}
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
