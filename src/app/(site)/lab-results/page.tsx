import type { Metadata } from 'next'
import { listMergedBatches } from '@/lib/catalog/merged'
import { BatchLookup } from '@/components/commerce/batch-lookup'
import { Badge } from '@/components/ui/badge'
import { FdaDisclaimer } from '@/components/compliance/fda-disclaimer'
import { PageSection } from '@/components/layout/page-section'
import { url } from '@/lib/seo/routes'
import { collectionPage, jsonLdScript } from '@/lib/seo/structured-data'
import { pageMetadata } from '@/lib/seo/meta'

export const metadata: Metadata = pageMetadata({
  title: 'Lab Results — Certificates of Analysis on Request',
  description: 'The laboratory report for your batch, issued to verified, licensed buyers on request: potency, heavy metals, pesticides, mycotoxins, solvents and microbials.',
  path: '/lab-results',
})

/**
 * The six panels, named individually.
 *
 * They were a sentence. Six things listed in prose read as one thing; ruled and
 * counted they read as six, which is the entire point — the competitor publishing
 * potency alone publishes one of these.
 */
const PANELS = [
  { name: 'Potency', detail: 'Active content, measured rather than claimed.' },
  {
    name: 'Heavy metals',
    detail: 'Lead, arsenic, cadmium and mercury, against ppm limits.',
  },
  { name: 'Pesticides', detail: 'A full 66-analyte screen, not a spot check.' },
  { name: 'Mycotoxins', detail: 'Aflatoxins B1, B2, G1, G2 and ochratoxin A.' },
  { name: 'Residual solvents', detail: 'Anything left behind by processing.' },
  { name: 'Microbials', detail: 'E. coli and salmonella, present or not.' },
] as const

export default async function LabResultsPage() {
  const batches = await listMergedBatches()
  const codes = batches.map((b) => b.batchCode)

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(
            collectionPage({
              name: 'Lab results',
              description:
                'Certificates of analysis, issued to verified licensed buyers on request against the batch code printed on the package.',
              path: url.labResults(),
              items: batches.map((b) => ({
                name: `Batch ${b.batchCode}`,
                path: url.labBatch(b.batchCode),
              })),
            }),
          ),
        }}
      />
      <PageSection first>

        {/*
          ─────────────────────────────────────────────────────────────────────
           A LEDGER, NOT A LANDING PAGE.
          ─────────────────────────────────────────────────────────────────────

          This page is the site's evidence, and it was dressed as marketing: a
          centred title, a lookup in a rounded card, and the batches as a grid of
          equal cards with an icon on each. Cards flatten a set of records into a
          set of adverts — every batch given the same weight, nothing scannable,
          and the one thing a visitor came to do (find THEIR code) buried under a
          heading.

          What it is instead: a statement, the lookup as the first thing on the
          page, then the batches as a dense table. A laboratory register should
          look like a register. That is not a stylistic preference here — the
          argument this business makes is "you can check us", and a page that
          looks like a record is more persuasive than one that looks designed.
        */}
        <section>
          <p className="text-xs font-medium tracking-[0.22em] text-foreground-subtle uppercase">
            Certificates of analysis
          </p>
          <h1 className="mt-5 max-w-4xl font-display text-4xl leading-[1.05] text-balance text-foreground lg:text-5xl">
            Certificates are issued on request, to verified buyers.
          </h1>
          <p className="mt-6 max-w-[62ch] text-lg leading-relaxed text-pretty text-foreground-muted">
            A certified copy of the laboratory report is released to verified, licensed
            buyers rather than posted publicly. Ask for the one covering the batch code
            printed on your package and we will send it to you.
          </p>
          <p className="mt-6">
            <a
              href={url.contact()}
              className="inline-flex min-h-11 items-center rounded-md bg-primary px-5 text-sm font-medium text-background hover:opacity-90"
            >
              Request a certificate
            </a>
          </p>

          {/* The lookup returns the moment reports are published here again. */}
          {codes.length > 0 ? (
            <div className="mt-8 max-w-xl">
              <BatchLookup knownCodes={codes} />
            </div>
          ) : null}
        </section>
      </PageSection>

      <PageSection tone="sunken">
        {/*
          WHAT A PANEL COVERS — as a specimen list.

          This was a paragraph naming six analyte groups in a sentence. Six named
          things in prose is six things nobody counts; ruled and numbered, the
          count IS the argument, because the competitor publishing potency alone
          publishes one of them.
        */}
        <section>
          <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
            <h2 className="font-display text-2xl text-foreground">
              What a certificate covers
            </h2>
            <a
              href={url.guide('how-to-read-a-certificate-of-analysis')}
              className="inline-flex min-h-11 items-center text-sm text-primary underline underline-offset-4"
            >
              How to read a certificate of analysis
            </a>
          </div>

          <p className="mt-3 max-w-[68ch] leading-relaxed text-pretty text-foreground-muted">
            Potency alone is not a safety test. A report that shows only active content
            is telling you the least useful part of it.
          </p>

          <ol className="mt-10 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {PANELS.map((panel, i) => (
              <li key={panel.name} className="border-t-2 border-foreground/20 pt-4">
                <span className="tabular font-product block text-xs text-foreground-subtle">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="mt-2 font-display text-lg leading-snug text-balance text-foreground">
                  {panel.name}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-pretty text-foreground-muted">
                  {panel.detail}
                </p>
              </li>
            ))}
          </ol>
        </section>
      </PageSection>

      <PageSection>
        {/*
          THE REGISTER.

          A table, because these are records. Codes set in the product face with
          tabular figures so they align down the column and a mistyped one is
          visible at a glance; the whole row is the target, not a link inside it.
        */}
        <section>
          <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
            <h2 className="font-display text-2xl text-foreground">
              {batches.length > 0 ? 'Published batches' : 'Asking for your certificate'}
            </h2>
            {batches.length > 0 ? (
              <p className="tabular text-sm text-foreground-subtle">{batches.length} on file</p>
            ) : null}
          </div>

          {batches.length === 0 ? (
            <div className="mt-6 max-w-[68ch] space-y-4 leading-relaxed text-pretty text-foreground-muted">
              <p>
                No reports are posted on this page. Certified copies go to verified, licensed
                buyers, one batch at a time, so a report is always released to a named buyer
                against a named batch rather than left open for anyone to attach to anything.
              </p>
              <p>
                Send us the batch code printed on your package, along with the licence you
                buy under, and we will send the certificate covering it.{' '}
                <a href={url.contact()} className="text-primary underline underline-offset-4">
                  Contact us
                </a>
                .
              </p>
            </div>
          ) : null}

          <div className={batches.length > 0 ? 'mt-6 overflow-x-auto' : 'hidden'}>
            <table className="w-full min-w-[36rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-border">
                  {['Batch', 'Laboratory', 'Tested', 'Accreditation', ''].map((h) => (
                    <th
                      key={h}
                      scope="col"
                      className="py-3 pr-6 text-xs font-medium tracking-[0.14em] text-foreground-subtle uppercase"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr
                    key={b.batchCode}
                    className="group/row border-b border-border transition-colors duration-150 ease-[var(--ease-standard)] hover:bg-surface-sunken motion-reduce:transition-none"
                  >
                    <td className="py-4 pr-6">
                      {/*
                        A real 44px target rather than a stretched link.

                        This used to carry `after:absolute after:inset-0` and a comment
                        claiming the whole row was clickable. It was not: `relative` sat
                        on the anchor, so the pseudo-element resolved against its own
                        21px text box. Moving `relative` up to the <tr> does not rescue
                        it either — a table row does not reliably establish a containing
                        block for absolutely positioned descendants, which is why the
                        pattern belongs on the product card's <article> and not here.
                        Clicking mid-row navigated nowhere in either arrangement.

                        So the anchor is simply given the height it needs. It clears the
                        24px floor of WCAG 2.5.8 with room to spare, and it does what it
                        looks like it does.
                      */}
                      <a
                        href={url.labBatch(b.batchCode)}
                        className="tabular font-product inline-flex min-h-11 items-center font-semibold text-foreground underline decoration-border-data underline-offset-4 transition-colors hover:decoration-foreground"
                      >
                        {b.batchCode}
                      </a>
                    </td>
                    <td className="py-4 pr-6 text-sm text-foreground-muted">{b.labName}</td>
                    <td className="tabular py-4 pr-6 text-sm text-foreground-muted">
                      {new Date(b.testedAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="py-4 pr-6">
                      {b.isoAccredited ? (
                        <Badge tone="info">ISO 17025</Badge>
                      ) : (
                        <span className="text-sm text-foreground-subtle">—</span>
                      )}
                    </td>
                    <td className="py-4 text-right">
                      <span
                        aria-hidden
                        className="inline-block text-foreground-subtle transition-transform duration-200 ease-[var(--ease-standard)] group-hover/row:translate-x-1 motion-reduce:transition-none"
                      >
                        →
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <FdaDisclaimer className="mt-10" />
      </PageSection>
    </main>
  )
}
