import { db } from '@/lib/db/client'
import { AdminPage, Cell, DataTable, EmptyState, Row, StatCard } from '@/components/admin/shell'
import { PushComposer } from '@/components/admin/push-composer'

export const metadata = { title: 'Push notifications' }

/**
 * Push notifications: who can receive them, send one to everyone, and what was sent.
 *
 * NO AUTO-REFRESH, deliberately — see the note in /admin/errors. Neon only suspends
 * after ~5 minutes with zero queries, and this is a page an operator leaves open.
 */

function when(date: Date): string {
  return `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`
}

async function Notifications() {
  const [total, ios, android, installed, history] = await Promise.all([
    db.pushSubscription.count(),
    db.pushSubscription.count({ where: { platform: 'ios' } }),
    db.pushSubscription.count({ where: { platform: 'android' } }),
    db.pushSubscription.count({ where: { installed: true } }),
    db.pushBroadcast.findMany({ orderBy: { createdAt: 'desc' }, take: 30 }),
  ])

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Devices with notifications on" value={total} tone={total > 0 ? 'success' : undefined} />
        <StatCard label="iPhone & iPad" value={ios} />
        <StatCard label="Android" value={android} />
        <StatCard label="From the installed app" value={installed} />
      </div>

      <section className="mt-6">
        <PushComposer subscribers={total} />
      </section>

      <section className="mt-8">
        <h2 className="font-display text-xl text-foreground">Sent</h2>
        {history.length === 0 ? (
          <div className="mt-3">
            <EmptyState title="Nothing sent yet" hint="Notifications you send to everyone are listed here, with how many arrived." />
          </div>
        ) : (
          <div className="mt-3">
            <DataTable headers={['Notification', 'Opens', 'Delivered', 'Sent']}>
              {history.map((b) => (
                <Row key={b.id}>
                  <Cell className="text-foreground">
                    <span className="block font-medium break-words">{b.title}</span>
                    <span className="block text-sm break-words text-foreground-muted">{b.body}</span>
                  </Cell>
                  <Cell className="text-xs break-all text-foreground-muted">{b.url}</Cell>
                  <Cell className="tabular text-sm">
                    <span className="text-success-fg">{b.delivered}</span>
                    <span className="text-foreground-subtle"> / {b.recipients}</span>
                    {b.failed || b.removed ? (
                      <span className="block text-xs text-foreground-subtle">
                        {b.failed ? `${b.failed} failed` : ''}
                        {b.failed && b.removed ? ' · ' : ''}
                        {b.removed ? `${b.removed} removed` : ''}
                      </span>
                    ) : null}
                  </Cell>
                  <Cell className="tabular text-xs text-foreground-muted">
                    {when(b.createdAt)}
                    <span className="block break-all text-foreground-subtle">{b.sentBy}</span>
                  </Cell>
                </Row>
              ))}
            </DataTable>
          </div>
        )}
      </section>
    </>
  )
}

export default function NotificationsPage() {
  return (
    <AdminPage
      title="Push notifications"
      description="Messages that arrive on the lock screen of everyone who turned notifications on, even with the site closed. Replies you send in Messages and payment details reach the customer this way too."
    >
      <Notifications />
    </AdminPage>
  )
}
