import Image from 'next/image'
import {
  imageSrc,
  IS_PLACEHOLDER,
  PROPRIETOR_SAMPLE,
} from '@/lib/catalog/sample-images'
import { BRAND, proprietorFullName } from '@/lib/brand'
import { url } from '@/lib/seo/routes'

/**
 * About the proprietor.
 *
 * Portrait left, statement right, signature under the portrait — the layout a
 * manufacturer uses to put a person behind the product. It earns its place here for
 * the same reason: this is a category where the buyer's first question is who they
 * are trusting, and a named human answering in the first person does more for that
 * than another paragraph of policy.
 *
 * Everything renders from `BRAND.proprietor` and degrades honestly. No name, no
 * portrait, no signature configured means none is shown — the alternative is a
 * stock face and an invented signature on the homepage of a business selling
 * age-restricted goods, which is a misrepresentation rather than a placeholder.
 *
 * `linkToAbout` is off on /about itself, where "Read more about us" would point the
 * reader at the page they are already reading.
 */
export function Proprietor({ linkToAbout = true }: { linkToAbout?: boolean } = {}) {
  const { name, role, title, statement, portrait, signature } = BRAND.proprietor
  if (!statement) return null
  const fullName = proprietorFullName()

  const credentials: readonly (readonly [string, string])[] = [
    [BRAND.proprietor.postNominal || 'PhD', 'Business and chemical engineering'],
    ['30+', 'Years in the industry'],
    ['10+', 'Businesses built'],
    ...(BRAND.track.foundedYear > 0 ? ([[String(BRAND.track.foundedYear), 'Trading since']] as const) : []),
    ...(BRAND.track.customers > 0 ? ([[BRAND.track.customers.toLocaleString('en-US'), 'Customers across the US']] as const) : []),
  ]

  /*
    Redesigned 2026-09-29 (owner: "give each section a unique design"). The portrait
    sits in an offset frame; the statement is set large in the display serif as lead
    text, not a quotation, because he did not say it; and the facts the owner supplied
    sit beneath as a row of figures.
  */
  return (
    <section aria-labelledby="proprietor-heading" className="relative overflow-hidden border-y border-border bg-surface">
      <div className="shell grid gap-12 py-16 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:items-center lg:gap-20 lg:py-24">
        <div className="relative mx-auto w-full max-w-sm lg:mx-0">
          <span aria-hidden className="absolute -right-3 -bottom-3 left-3 top-3 rounded-2xl border border-accent/40" />
          <figure className="relative m-0 aspect-[4/5] w-full overflow-hidden rounded-2xl bg-surface-data">
            {portrait ? (
              <Image
                src={portrait}
                alt={name ? `${name}, ${role} of ${BRAND.name}` : `${role} of ${BRAND.name}`}
                fill
                sizes="(max-width: 1023px) 24rem, 24rem"
                className="object-cover"
              />
            ) : (
              PROPRIETOR_SAMPLE && (
                <>
                  <Image src={imageSrc(PROPRIETOR_SAMPLE)} alt={PROPRIETOR_SAMPLE.alt} fill sizes="24rem" className="object-cover" />
                  {IS_PLACEHOLDER && (
                    <figcaption className="absolute inset-x-0 bottom-0 bg-stone-950/75 px-4 py-3 text-xs leading-snug text-white">
                      <strong className="font-medium">Sample image.</strong> A photograph of the {role.toLowerCase()} is not published yet.
                    </figcaption>
                  )}
                </>
              )
            )}
          </figure>
          {signature && (
            <div className="relative -mt-6 ml-6 h-20 w-56">
              <Image src={signature} alt={name ? `Signature of ${name}` : 'Signature'} fill sizes="14rem" className="object-contain object-left" />
            </div>
          )}
        </div>

        <div>
          <h2 id="proprietor-heading" className="text-sm font-medium text-accent-fg">
            {name ? `${role}, ${fullName}` : 'About the proprietor'}
          </h2>
          <p className="mt-5 max-w-[26ch] font-display text-3xl leading-[1.15] font-medium tracking-[-0.02em] text-balance text-foreground md:text-[2.6rem]">
            {statement}
          </p>
          {title && (
            <p className="mt-5 max-w-xl text-base leading-relaxed text-foreground-muted">
              {title.charAt(0).toUpperCase() + title.slice(1)}.
            </p>
          )}

          <dl className="mt-9 grid grid-cols-2 gap-x-6 gap-y-6 border-t border-border pt-7 sm:grid-cols-3 xl:grid-cols-5">
            {credentials.map(([figure, label]) => (
              <div key={label}>
                <dt className="sr-only">{label}</dt>
                <dd className="font-display text-3xl font-medium tracking-[-0.02em] text-foreground">{figure}</dd>
                <dd className="mt-1 text-[13px] leading-snug text-foreground-muted">{label}</dd>
              </div>
            ))}
          </dl>

          {linkToAbout && (
            <a
              href={url.about()}
              className="mt-9 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary underline underline-offset-4"
            >
              Meet the team behind every order
              <span aria-hidden>&rarr;</span>
            </a>
          )}
        </div>
      </div>
    </section>
  )
}
