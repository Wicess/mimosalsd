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

  return (
    <section
      aria-labelledby="proprietor-heading"
      className="border-y border-border bg-surface"
    >
      <div className="shell grid gap-10 py-14 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-center lg:gap-16 lg:py-20">
        <div>
          {/*
            Reserved 4:5 box. It holds its shape whether or not a portrait exists, so
            configuring one later cannot shift the section.
          */}
          <figure className="relative m-0 aspect-[4/5] w-full overflow-hidden rounded-2xl bg-surface-data">
            {portrait ? (
              <Image
                src={portrait}
                alt={name ? `${name}, ${role} of ${BRAND.name}` : `${role} of ${BRAND.name}`}
                fill
                sizes="(max-width: 1023px) 100vw, 26rem"
                className="object-cover"
              />
            ) : (
              PROPRIETOR_SAMPLE && (
                <>
                  <Image
                    src={imageSrc(PROPRIETOR_SAMPLE)}
                    alt={PROPRIETOR_SAMPLE.alt}
                    fill
                    sizes="(max-width: 1023px) 100vw, 26rem"
                    className="object-cover"
                  />
                  {/*
                    Says what is actually pictured and what is not.

                    The plate used to be an empty grey box reading "Photograph not
                    published yet", which was honest and looked broken. This is
                    the same admission over a photograph that earns its place —
                    and it names the absence rather than letting a reader assume
                    the material shot IS the proprietor.
                  */}
                  {IS_PLACEHOLDER && (
                    <figcaption className="absolute inset-x-0 bottom-0 bg-stone-950/75 px-4 py-3 text-xs leading-snug text-white">
                      <strong className="font-medium">Sample image.</strong> A
                      photograph of the {role.toLowerCase()} is not published yet —
                      this is the material the business is built on.
                    </figcaption>
                  )}
                </>
              )
            )}
          </figure>

          {/*
            Overlaps the portrait's lower edge, the way a signed print does. Only ever
            a real configured mark — never generated.
          */}
          {signature && (
            <div className="relative -mt-6 ml-6 h-20 w-56">
              <Image
                src={signature}
                alt={name ? `Signature of ${name}` : 'Signature'}
                fill
                sizes="14rem"
                className="object-contain object-left"
              />
            </div>
          )}
        </div>

        <div>
          <h2
            id="proprietor-heading"
            className="text-xs font-medium tracking-[0.2em] text-foreground-subtle uppercase"
          >
            About the proprietor
          </h2>

          {/*
            Body sans at display size, not the editorial serif: it is a person
            speaking, and the weight is what carries it.

            Steps up at `md`, not `sm`. This project sets `--breakpoint-sm` to 375px,
            so `sm:` is true on every phone — `sm:text-3xl` put display type on a
            375px screen and ran this statement to twenty lines.
          */}
          <p className="mt-5 max-w-[34ch] font-sans text-lg leading-[1.3] font-bold tracking-[-0.01em] text-balance text-foreground md:text-2xl md:leading-[1.25]">
            {statement}
          </p>

          {name && (
            <div className="mt-6 text-sm">
              <p className="text-foreground-muted">
                <span className="font-medium text-foreground">{fullName}</span>
                <span aria-hidden> · </span>
                {role}, {BRAND.legalName}
              </p>
              {title && (
                <p className="mt-1 text-foreground-subtle">
                  {title.charAt(0).toUpperCase() + title.slice(1)}
                </p>
              )}
            </div>
          )}

          {linkToAbout && (
            <a
              href={url.about()}
              className="mt-8 inline-block min-h-11 border-b border-border-strong pt-2 text-sm text-foreground transition-colors hover:border-foreground"
            >
              Read more about us
            </a>
          )}
        </div>
      </div>
    </section>
  )
}
