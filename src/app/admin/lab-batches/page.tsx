import { db } from '@/lib/db/client'
import { catalog } from '@/lib/catalog/repository'
import { InlineAction } from '@/components/admin/forms'
import { toggleBatchPublished } from '@/app/actions/admin-crud'
import { AdminPage, Cell, DataTable, Row } from '@/components/admin/shell'
import { Badge } from '@/components/ui/badge'
import { url } from '@/lib/seo/routes'

const REQUIRED_PANELS = ['HEAVY_METALS', 'PESTICIDES', 'MYCOTOXINS', 'SOLVENTS'] as const

async function Batches() {
  const batches = catalog.listBatches()
  const rows = await db.labBatch.findMany({ select: { id: true, batchCode: true, isPublished: true } })
  const byCode = new Map(rows.map((r) => [r.batchCode, r]))
  return (
    <DataTable headers={['Batch', 'Laboratory', 'Tested', 'Panels', 'Products', 'Status', '']}>
      {batches.map((b) => {
        const panels = new Set(b.results.map((r) => r.panel))
        const missing = REQUIRED_PANELS.filter((p) => !panels.has(p))
        const failed = b.results.filter((r) => !r.passed)
        const products = catalog.listProducts().filter((p) => p.batchCodes.includes(b.batchCode))
        return (
          <Row key={b.batchCode}>
            <Cell>
              <a href={url.labBatch(b.batchCode)} className="tabular font-medium text-foreground underline underline-offset-4">
                {b.batchCode}
              </a>
            </Cell>
            <Cell className="text-foreground-muted">
              {b.labName}
              {b.isoAccredited && <Badge tone="info" className="ml-2">ISO 17025</Badge>}
            </Cell>
            <Cell className="tabular text-xs text-foreground-muted">{b.testedAt}</Cell>
            <Cell className="tabular text-xs text-foreground-muted">
              {b.results.length} results · {panels.size} panels
            </Cell>
            <Cell className="text-xs text-foreground-muted">{products.length}</Cell>
            <Cell>
              {/*
                Potency alone is not a safety test. A batch missing a contaminant panel
                is flagged here rather than quietly published.
              */}
              {failed.length > 0 ? (
                <Badge tone="danger">{failed.length} out of spec</Badge>
              ) : missing.length > 0 ? (
                <Badge tone="warning">missing {missing.length} panel(s)</Badge>
              ) : (
                <Badge tone="success">full panel, in spec</Badge>
              )}
            </Cell>
            <Cell>
              {(() => {
                const row = byCode.get(b.batchCode)
                if (!row) return <span className="text-xs text-foreground-subtle">not in DB</span>
                return (
                  <div className="flex flex-col gap-1">
                    <Badge tone={row.isPublished ? 'success' : 'neutral'}>
                      {row.isPublished ? 'published' : 'draft'}
                    </Badge>
                    {/* Publishing is refused server-side when a contaminant panel is missing. */}
                    <InlineAction
                      action={toggleBatchPublished}
                      label={row.isPublished ? 'Unpublish' : 'Publish'}
                      fields={{ id: row.id }}
                    />
                  </div>
                )
              })()}
            </Cell>
          </Row>
        )
      })}
    </DataTable>
  )
}

export default function AdminLabBatchesPage() {
  return (
    <AdminPage
      title="Lab batches"
      description="Every batch is addressable by the code printed on the package. A batch missing a contaminant panel is flagged rather than quietly published — potency alone is not a safety test."
    >
      <Batches />
    </AdminPage>
  )
}
