import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/seo/meta'
import { publishedLocations, LOCATIONS, publishBlockers } from '@/lib/locations/locations'
import { jurisdictionName } from '@/lib/compliance/jurisdictions'
import { url } from '@/lib/seo/routes'
import { MapPinIcon } from '@/components/ui/icon'
import { collectionPage, jsonLdScript } from '@/lib/seo/structured-data'
import { PageHeader } from '@/components/layout/page-header'
import { PageSection } from '@/components/layout/page-section'

export const metadata: Metadata = pageMetadata({
  title: 'Locations & Pickup',
  description: 'Where to find us in person, which ZIP codes we reach with same-day local delivery, and what each location can lawfully stock. Everything else ships nationwide.',
  path: '/locations',
})

export default function LocationsPage() {
  const published = publishedLocations()
  const pending = LOCATIONS.filter((l) => !l.isPublished)

  return (
    <main>
      {/*
        Only PUBLISHED locations are listed — the ones that physically exist and have
        a claimed business profile. Marking up a location we cannot stand behind is
        the doorway problem in structured-data form, and the emitted list is empty
        rather than aspirational when nothing has been published yet.
      */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(
            collectionPage({
              name: 'Locations',
              description:
                'Where to find us in person, and which ZIP codes we reach with same-day local delivery.',
              path: url.locationsHub(),
              items: published.map((l) => ({
                name: `${l.name} — ${l.city}, ${l.stateCode}`,
                path: url.location(l.slug),
              })),
            }),
          ),
        }}
      />
      <PageSection first>
        <PageHeader
          title="Locations"
          summary="Where we operate, and how orders reach you."
        />

        {published.length === 0 ? (
          <>
            <p className="mt-4 max-w-4xl text-lg text-foreground-muted">
              We do not have a public storefront listed yet. Everything ships nationwide
              from our fulfilment centre, and{' '}
              <a href={url.shopNearMe()} className="text-primary underline underline-offset-4">
                you can check exactly what we send to your state
              </a>
              .
            </p>

            {/*
              Pending locations are shown to the operator with their blockers, never to
              the public and never in the sitemap. A page for a location that does not
              physically exist is the doorway pattern Google penalises — and it is fraud.
            */}
            {pending.length > 0 && (
              <section className="mt-10 rounded-lg bg-warning-bg p-5 text-warning-fg">
                <h2 className="font-display text-lg">
                  {pending.length} location{pending.length === 1 ? '' : 's'} awaiting real data
                </h2>
                <ul className="mt-3 space-y-4 text-sm">
                  {pending.map((l) => (
                    <li key={l.slug}>
                      <p className="font-medium">
                        {l.name} — {l.city}, {jurisdictionName(l.stateCode)}
                      </p>
                      <ul className="mt-1 list-disc space-y-1 pl-5 opacity-90">
                        {publishBlockers(l).map((b) => (
                          <li key={b}>{b}</li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs opacity-90">
                  Not rendered publicly and excluded from the sitemap until resolved.
                </p>
              </section>
            )}
          </>
        ) : (
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {published.map((l) => (
              <li key={l.slug} className="rounded-lg border border-border bg-surface p-5">
                <a href={url.location(l.slug)} className="flex gap-3">
                  <MapPinIcon className="mt-0.5 size-5 text-primary" />
                  <span>
                    <span className="block font-medium text-foreground">{l.name}</span>
                    <span className="block text-sm text-foreground-muted">
                      {l.addressLine1}, {l.city}, {l.stateCode} {l.postalCode}
                    </span>
                    {l.offersSameDay && (
                      <span className="mt-1 block text-sm text-success-fg">
                        Same-day delivery in {l.sameDayZips.length} ZIP codes
                      </span>
                    )}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </PageSection>
    </main>
  )
}
