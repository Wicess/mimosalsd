import Link from 'next/link'
import { db } from '@/lib/db/client'
import { AdminPage, Cell, DataTable, EmptyState, Row } from '@/components/admin/shell'
import { Badge } from '@/components/ui/badge'
import { CAMPAIGN_STATUS_TONE, campaignStatusLabel } from '@/lib/mail/campaign-status'

export const metadata = { title: 'Email blasts' }

async function Campaigns() {
  const [rows, subscribers] = await Promise.all([
    db.emailCampaign.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
    db.newsletterSubscriber.count({ where: { isActive: true } }),
  ])

  return (
    <>
      <p className="mb-4 text-sm text-foreground-muted">
        {subscribers} active subscriber{subscribers === 1 ? '' : 's'}. Blasts go out in shifts of 100, one click each,
        and carry on where the last shift stopped.
      </p>
      {rows.length === 0 ? (
        <EmptyState
          title="No blasts yet"
          hint="Every blast is checked against the compliance lexicon before it can send, and carries an unsubscribe link and your postal address."
        />
      ) : (
        <DataTable headers={['Blast', 'Sent to', 'Status', 'Created']}>
          {rows.map((c) => (
            <Row key={c.id}>
              <Cell>
                <Link
                  href={`/admin/campaigns/${c.id}`}
                  prefetch={false}
                  className="font-medium text-foreground underline underline-offset-4"
                >
                  {c.name}
                </Link>
                <span className="mt-0.5 block text-xs text-foreground-muted">{c.subject}</span>
              </Cell>
              <Cell className="tabular text-foreground">
                {c.delivered}
                {c.failed > 0 && <span className="ml-2 text-danger-fg">{c.failed} failed</span>}
              </Cell>
              <Cell>
                <Badge tone={CAMPAIGN_STATUS_TONE[c.status] ?? 'neutral'}>{campaignStatusLabel(c.status)}</Badge>
              </Cell>
              <Cell className="tabular text-xs text-foreground-muted">{c.createdAt.toISOString().slice(0, 10)}</Cell>
            </Row>
          ))}
        </DataTable>
      )}
    </>
  )
}

export default function AdminCampaignsPage() {
  return (
    <AdminPage
      title="Email blasts"
      description="One-off messages to newsletter subscribers, separate from order emails. Each is checked against the compliance lexicon before it can go out."
      actions={
        <Link
          href="/admin/campaigns/new"
          className="inline-flex min-h-11 items-center rounded-md bg-primary px-3 text-sm font-medium text-on-primary hover:bg-primary-hover"
        >
          New blast
        </Link>
      }
    >
      <Campaigns />
    </AdminPage>
  )
}
