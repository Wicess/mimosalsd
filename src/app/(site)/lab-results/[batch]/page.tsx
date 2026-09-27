import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { getMergedBatch, listMergedBatches, listMergedProducts } from '@/lib/catalog/merged'
import { Badge } from '@/components/ui/badge'
import { FdaDisclaimer } from '@/components/compliance/fda-disclaimer'
import { PageSection } from '@/components/layout/page-section'
import { absoluteUrl, url } from '@/lib/seo/routes'
import { breadcrumbList, jsonLdScript } from '@/lib/seo/structured-data'
import { pageMetadata } from '@/lib/seo/meta'
import { BRAND } from '@/lib/brand'

/*
  Never an empty list: Cache Components rejects one. With no reports published (they
  are issued on request), a placeholder matches no batch and renders notFound().
*/
export async function generateStaticParams() {
  const published = (await listMergedBatches()).map((b) => ({ batch: b.batchCode.toLowerCase() }))
  return published.length > 0 ? published : [{ batch: '__placeholder__' }]
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ batch: string }>
}): Promise<Metadata> {
  const { batch: code } = await params
  const batch = await getMergedBatch(code)
  if (!batch) return {}
  return pageMetadata({
    title: `Batch ${batch.batchCode} — Certificate of Analysis`,
    description: `Laboratory report for batch ${batch.batchCode}, tested by ${batch.labName}. Full panel: potency, heavy metals, pesticides, mycotoxins, solvents and microbials.`,
    path: url.labBatch(batch.batchCode),
  })
}

const PANEL_LABEL: Record<string, string> = {
  POTENCY: 'Potency',
  HEAVY_METALS: 'Heavy metals',
  PESTICIDES: 'Pesticides',
  MYCOTOXINS: 'Mycotoxins',
  SOLVENTS: 'Residual solvents',
  MICROBIALS: 'Microbials',
}

async function BatchBody({ params }: { params: Promise<{ batch: string }> }) {
  const { batch: code } = await params
  const batch = await getMergedBatch(code)
  if (!batch) notFound()

  // Merged, so a product POSTED from the admin panel appears against its batch too.
  // The authored list is empty, so reading it here listed nothing.
  const products = (await listMergedProducts()).filter((p) =>
    p.batchCodes.includes(batch.batchCode),
  )

  const panels = [...new Set(batch.results.map((r) => r.panel))]
  const allPassed = batch.results.every((r) => r.passed)

  const jsonLd = [
    {
    '@context': 'https://schema.org',
    '@type': 'Report',
    name: `Certificate of Analysis — Batch ${batch.batchCode}`,
    identifier: batch.batchCode,
    datePublished: batch.testedAt,
    publisher: { '@type': 'Organization', name: batch.labName },
    about: products.map((p) => ({ '@type': 'Product', name: p.name })),
    isPartOf: { '@id': absoluteUrl('/#website') },
    },
    breadcrumbList([
      { name: 'Lab results', path: url.labResults() },
      { name: `Batch ${batch.batchCode}`, path: url.labBatch(batch.batchCode) },
    ]),
  ]

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />

      <PageSection first>
      <nav aria-label="Breadcrumb" className="text-sm text-foreground-muted">
        <a href={url.labResults()} className="inline-flex min-h-11 items-center underline underline-offset-4">Lab results</a>
        <span aria-hidden> / </span>
        <span className="tabular font-product text-foreground">{batch.batchCode}</span>
      </nav>

      <h1 className="tabular mt-4 font-display text-4xl text-foreground">
        Batch {batch.batchCode}
      </h1>

      <dl className="mt-5 grid gap-4 rounded-lg border border-border-data bg-surface-data p-5 sm:grid-cols-2">
        <div>
          <dt className="text-xs tracking-wide text-foreground-muted uppercase">Laboratory</dt>
          <dd className="mt-1 font-medium text-foreground">
            {batch.labName}
            {batch.isoAccredited && (
              <Badge tone="info" className="ml-2">ISO 17025</Badge>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs tracking-wide text-foreground-muted uppercase">Tested</dt>
          <dd className="mt-1 font-medium text-foreground">
            <time dateTime={batch.testedAt}>
              {new Date(batch.testedAt).toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric',
              })}
            </time>
          </dd>
        </div>
        <div>
          <dt className="text-xs tracking-wide text-foreground-muted uppercase">Contracted by</dt>
          <dd className="mt-1 font-medium text-foreground">{BRAND.legalName}</dd>
        </div>
        <div>
          <dt className="text-xs tracking-wide text-foreground-muted uppercase">Overall</dt>
          <dd className="mt-1">
            <Badge tone={allPassed ? 'success' : 'danger'}>
              {allPassed ? 'All analytes within specification' : 'Review required'}
            </Badge>
          </dd>
        </div>
      </dl>

      <p className="mt-4 text-sm text-foreground-muted">
        Check that this code matches the one printed on your package. If it does not,
        you are reading the wrong report.
      </p>

      {panels.map((panel) => (
        <section key={panel} className="mt-8">
          <h2 className="font-display text-xl text-foreground">
            {PANEL_LABEL[panel] ?? panel}
          </h2>
          <table className="tabular mt-3 w-full overflow-hidden rounded-lg border border-border-data text-sm">
            <thead className="bg-surface-data text-left">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium text-foreground">Analyte</th>
                <th scope="col" className="px-4 py-2 font-medium text-foreground">Result</th>
                <th scope="col" className="px-4 py-2 font-medium text-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {batch.results
                .filter((r) => r.panel === panel)
                .map((r) => (
                  <tr key={r.analyte} className="border-t border-border-data">
                    <td className="px-4 py-2 text-foreground">{r.analyte}</td>
                    <td className="px-4 py-2 text-foreground-muted">
                      {r.value} {r.unit ?? ''}
                    </td>
                    <td className="px-4 py-2">
                      <Badge tone={r.passed ? 'success' : 'danger'}>
                        {r.passed ? 'Pass' : 'Fail'}
                      </Badge>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </section>
      ))}

      {products.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-xl text-foreground">
            Products covered by this batch
          </h2>
          <ul className="mt-3 space-y-2">
            {products.map((p) => (
              <li key={p.slug}>
                <a
                  href={url.product(p.slug)}
                  className="inline-flex min-h-11 items-center text-primary underline underline-offset-4"
                >
                  {p.name}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      </PageSection>

      <PageSection tone="sunken">
      <FdaDisclaimer className="mt-12" />
      </PageSection>
    </>
  )
}

export default function BatchPage({ params }: { params: Promise<{ batch: string }> }) {
  return (
    <main>
      <Suspense fallback={<div className="shell py-12"><div className="min-h-[70vh] animate-pulse rounded-lg bg-surface-sunken" aria-hidden /></div>}>
        <BatchBody params={params} />
      </Suspense>
    </main>
  )
}
