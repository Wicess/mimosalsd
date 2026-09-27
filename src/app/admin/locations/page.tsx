import { LOCATIONS, publishBlockers } from '@/lib/locations/locations'
import { AdminPage, Cell, DataTable, Row } from '@/components/admin/shell'
import { Badge } from '@/components/ui/badge'
import { jurisdictionName } from '@/lib/compliance/jurisdictions'

async function Locations() {
  return (
    <DataTable headers={['Location', 'State', 'Same-day', 'Status', 'Blockers']}>
      {LOCATIONS.map((l) => {
        const blockers = publishBlockers(l)
        return (
          <Row key={l.slug}>
            <Cell>
              <span className="font-medium text-foreground">{l.name}</span>
              <span className="mt-0.5 block text-xs text-foreground-muted">
                {l.addressLine1}, {l.city} {l.postalCode}
              </span>
            </Cell>
            <Cell className="text-foreground-muted">{jurisdictionName(l.stateCode)}</Cell>
            <Cell className="tabular text-xs text-foreground-muted">
              {l.offersSameDay ? `${l.sameDayZips.length} ZIPs · cut-off ${l.sameDayCutoff}` : '—'}
            </Cell>
            <Cell>
              <Badge tone={l.isPublished ? 'success' : 'warning'}>
                {l.isPublished ? 'published' : 'unpublished'}
              </Badge>
            </Cell>
            <Cell className="max-w-sm">
              {blockers.length === 0 ? (
                <span className="text-xs text-success-fg">Ready to publish</span>
              ) : (
                <ul className="list-disc space-y-1 pl-4 text-xs text-foreground-muted">
                  {blockers.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              )}
            </Cell>
          </Row>
        )
      })}
    </DataTable>
  )
}

export default function AdminLocationsPage() {
  return (
    <AdminPage
      title="Locations"
      description="A page exists only for a location that physically exists, and NAP must match the Google Business Profile byte-for-byte. Unpublished locations 404 and stay out of the sitemap."
    >
      <Locations />
    </AdminPage>
  )
}
