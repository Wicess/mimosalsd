import { ensureLiveStateRules } from '@/lib/compliance/live-state-rules'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import {
  getLocation,
  localBusinessJsonLd,
  type Location,
} from '@/lib/locations/locations'
import { getStateLegality } from '@/lib/legality/state-pages'
import { jurisdictionName } from '@/lib/compliance/jurisdictions'
import { pageMetadata } from '@/lib/seo/meta'
import { FdaDisclaimer } from '@/components/compliance/fda-disclaimer'
import { PageSection } from '@/components/layout/page-section'
import { BRAND } from '@/lib/brand'
import { absoluteUrl, url } from '@/lib/seo/routes'

/**
 * `generateStaticParams` is deliberately ABSENT while no location is published.
 *
 * Cache Components requires it to return at least one result, and there is genuinely
 * nothing to prerender: every slug currently 404s because no location has a real
 * address or a claimed Google Business Profile. Re-add it the moment the first
 * location goes live:
 *
 *   export async function generateStaticParams() {
 *     return publishedLocations().map((l) => ({ city: l.slug }))
 *   }
 *
 * Until then the route renders on demand and refuses everything, which is correct —
 * a page for a location that does not physically exist is the doorway pattern Google
 * penalises, and it is also untrue.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string }>
}): Promise<Metadata> {
  const { city } = await params
  const location = getLocation(city)
  if (!location || !location.isPublished) return {}
  return pageMetadata({
    title: `${BRAND.name} ${location.name} — ${location.city}, ${location.stateCode}`,
    description: `Visit us in ${location.city}, ${location.stateCode}. Same-day local delivery to selected ZIP codes, plus nationwide shipping on everything we can lawfully send to ${jurisdictionName(location.stateCode)}.`,
    path: url.location(city),
  })
}

async function LocationBody({ location }: { location: Location }) {
  await ensureLiveStateRules()
  const legality = getStateLegality(location.stateCode)

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            localBusinessJsonLd(location, BRAND.name, absoluteUrl('/')),
          ),
        }}
      />

      <PageSection first>
      <nav aria-label="Breadcrumb" className="text-sm text-foreground-muted">
        <a href={url.locationsHub()} className="inline-flex min-h-11 items-center underline underline-offset-4">Locations</a>
        <span aria-hidden> / </span>
        <span className="text-foreground">{location.name}</span>
      </nav>

      <h1 className="mt-4 font-display text-4xl text-foreground">
        {BRAND.name} {location.name}
      </h1>

      <address className="mt-4 text-base not-italic text-foreground-muted">
        {location.addressLine1}
        <br />
        {location.city}, {location.stateCode} {location.postalCode}
        <br />
        <a href={`tel:${location.phone}`} className="text-primary underline underline-offset-4">
          {location.phone}
        </a>
      </address>

      <section className="mt-8">
        <h2 className="font-display text-xl text-foreground">Opening hours</h2>
        <dl className="tabular mt-3 max-w-xs space-y-1 text-sm">
          {location.hours.map((h) => (
            <div key={h.day} className="flex justify-between">
              <dt className="text-foreground-muted">{h.day}</dt>
              <dd className="text-foreground">
                {h.opens}–{h.closes}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {location.offersSameDay && (
        <section className="mt-8 rounded-lg border border-border bg-surface p-5">
          <h2 className="font-display text-xl text-foreground">Same-day delivery</h2>
          <p className="mt-2 text-sm text-foreground-muted">
            We deliver the same day to {location.sameDayZips.length} ZIP codes around{' '}
            {location.city} for orders placed before {location.sameDayCutoff}.
          </p>
          <p className="tabular mt-2 text-sm text-foreground">
            {location.sameDayZips.join(' · ')}
          </p>
        </section>
      )}

      {location.cityContent && (
        <section className="mt-8">
          <h2 className="font-display text-xl text-foreground">About {location.city}</h2>
          <p className="mt-2 leading-relaxed text-foreground-muted">{location.cityContent}</p>
        </section>
      )}

      <section className="mt-8 rounded-lg border border-border bg-surface-sunken p-5">
        <h2 className="font-display text-xl text-foreground">
          What is legal in {jurisdictionName(location.stateCode)}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-foreground-muted">
          {legality.answerFirst}
        </p>
        <p className="mt-3 text-sm">
          <a
            href={url.legalityState(legality.slug)}
            className="text-primary underline underline-offset-4"
          >
            Full legal position for {legality.name}
          </a>
        </p>
      </section>

      </PageSection>

      <PageSection tone="sunken">
      <FdaDisclaimer className="mt-10" />
      </PageSection>
    </>
  )
}

/**
 * A deliberately blocking route.
 *
 * Cache Components offers three ways to handle dynamic data: stream it behind
 * Suspense, cache it, or block. Blocking is right here because the FIRST thing this
 * route must do is decide whether the location exists — and that decision sets the
 * HTTP status. Streaming it would emit 200 before the answer is known.
 */
export const instant = false

export default async function LocationPage({
  params,
}: {
  params: Promise<{ city: string }>
}) {
  /*
   * params is awaited HERE, not inside Suspense, and that is deliberate.
   *
   * Under PPR the HTTP status is sent before a Suspense child resolves, so a
   * notFound() deeper in the tree produces a 200 carrying not-found content — a soft
   * 404, which Google treats worse than a real one. Resolving the location up front
   * costs this route its static shell, which is no loss: a location that does not
   * exist has nothing worth prerendering.
   */
  const { city } = await params
  const location = getLocation(city)
  if (!location || !location.isPublished) notFound()

  return (
    <main>
      <Suspense fallback={<div className="shell py-12"><div className="min-h-[70vh] animate-pulse rounded-lg bg-surface-sunken" aria-hidden /></div>}>
        <LocationBody location={location} />
      </Suspense>
    </main>
  )
}
