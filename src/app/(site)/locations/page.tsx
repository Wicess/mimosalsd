import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/seo/meta'
import { publishedLocations } from '@/lib/locations/locations'
import { url } from '@/lib/seo/routes'
import { MapPinIcon } from '@/components/ui/icon'
import { collectionPage, jsonLdScript } from '@/lib/seo/structured-data'
import { PageHeader } from '@/components/layout/page-header'
import { PageSection } from '@/components/layout/page-section'

/*
  Noindex while no location is published: the page then says only "we have no
  storefront yet", which is thin, and CLAUDE.md rule 12 allows location pages only for
  places that physically exist. It indexes itself the day a real one is published.
*/
export const metadata: Metadata = {
  ...pageMetadata({
    title: 'Visit Us in California, Locations',
    description: 'Where to find us in person in California, once a storefront is listed. Until then, every order ships from our California branch to US addresses.',
    path: '/locations',
  }),
  ...(publishedLocations().length === 0 ? { robots: { index: false, follow: true } } : {}),
}

export default function LocationsPage() {
  const published = publishedLocations()

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
              We do not have a public storefront listed yet. Everything ships
              from our California branch, and{' '}
              <a href={url.shopNearMe()} className="text-primary underline underline-offset-4">
                you can check exactly what we send to your state
              </a>
              .
            </p>

            {/*
              Pending locations used to be listed here with their blockers, under a
              comment saying they were never shown to the public — but this component
              IS the public page, so every visitor saw "PENDING — city". The operator's
              view of them lives at /admin/locations.
            */}
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
