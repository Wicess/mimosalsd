import { db } from '@/lib/db/client'
import { AdminPage, Cell, DataTable, EmptyState, Row } from '@/components/admin/shell'
import { Badge } from '@/components/ui/badge'
import { CrudPanel, Field, InlineAction, Select, TextArea, Checkbox } from '@/components/admin/forms'
import { saveAnnouncement, toggleAnnouncement } from '@/app/actions/admin-crud'

const TONE: Record<string, 'neutral' | 'warning' | 'danger'> = {
  INFO: 'neutral',
  WARNING: 'warning',
  CRITICAL: 'danger',
}

async function Announcements() {
  const rows = await db.announcement.findMany({ orderBy: { createdAt: 'desc' }, take: 50 })

  const form = (
    <CrudPanel summary="+ New announcement" action={saveAnnouncement}>
      <Field label="Title" name="title" required placeholder="Shipping delay this week" />
      <TextArea
        label="Message"
        name="body"
        required
        hint="Shown site-wide. Scanned against the compliance lexicon before it saves."
      />
      <Select
        label="Severity"
        name="severity"
        options={[['INFO', 'Info'], ['WARNING', 'Warning'], ['CRITICAL', 'Critical']]}
      />
      <Checkbox label="Show it now" name="isActive" />
    </CrudPanel>
  )

  if (rows.length === 0) {
    return (
      <>
        {form}
        <EmptyState
          title="No announcements"
          hint="Use these for shipping delays, legal changes and holiday cut-offs."
        />
      </>
    )
  }
  return (
    <>
    {form}
    <DataTable headers={['Title', 'Severity', 'Window', 'Status', '']}>
      {rows.map((a) => (
        <Row key={a.id}>
          <Cell>
            <span className="font-medium text-foreground">{a.title}</span>
            <span className="mt-0.5 block max-w-md text-xs text-foreground-muted">{a.body}</span>
          </Cell>
          <Cell>
            <Badge tone={TONE[a.severity] ?? 'neutral'}>{a.severity.toLowerCase()}</Badge>
          </Cell>
          <Cell className="tabular text-xs text-foreground-muted">
            {a.startsAt?.toISOString().slice(0, 10) ?? 'now'} →{' '}
            {a.endsAt?.toISOString().slice(0, 10) ?? 'open'}
          </Cell>
          <Cell>
            <Badge tone={a.isActive ? 'success' : 'neutral'}>
              {a.isActive ? 'live' : 'off'}
            </Badge>
          </Cell>
          <Cell>
            <InlineAction
              action={toggleAnnouncement}
              label={a.isActive ? 'Hide' : 'Show'}
              fields={{ id: a.id }}
            />
          </Cell>
        </Row>
      ))}
    </DataTable>
    </>
  )
}

export default function AdminAnnouncementsPage() {
  return (
    <AdminPage
      title="Announcements"
      description="Site-wide banner for shipping delays, legal changes and holiday cut-offs."
    >
      <Announcements />
    </AdminPage>
  )
}
