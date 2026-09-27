import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AdminPage, StatCard } from '@/components/admin/shell'
import { InlineAction } from '@/components/admin/forms'
import { CampaignEditor, SendShiftButton, SendTestButton } from '@/components/admin/campaign-forms'
import { Badge } from '@/components/ui/badge'
import { deleteCampaign, sendCampaignShift, sendCampaignTest, updateCampaign } from '@/app/actions/admin-campaigns'
import { getAdminSession } from '@/lib/admin/auth'
import { db } from '@/lib/db/client'
import { campaignProgress, campaignTopic, mailConfigured, SHIFT_SIZE } from '@/lib/mail/blast'
import { campaignEmail, scanCampaign, sendProblems } from '@/lib/mail/campaign'
import { CAMPAIGN_STATUS_TONE, campaignStatusLabel } from '@/lib/mail/campaign-status'
import { fillCompanyEmail } from '@/lib/site/company-email'
import { getCompanyEmail } from '@/lib/site/company-email.server'
import { getPostalAddress } from '@/lib/site/postal-address.server'

export const metadata = { title: 'Email blast' }

/** A shift sends up to a hundred emails one after another; give it room. */
export const maxDuration = 300

function Panel({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4 sm:p-5">
      <h2 className="font-display text-lg text-foreground">{title}</h2>
      {hint ? <p className="mt-1 text-xs leading-relaxed text-foreground-muted">{hint}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  )
}

async function Campaign({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const campaign = await db.emailCampaign.findUnique({ where: { id } })
  if (!campaign) notFound()

  const [progress, session, contactEmail, postalAddress, failures] = await Promise.all([
    campaignProgress(id),
    getAdminSession(),
    getCompanyEmail(),
    getPostalAddress(),
    db.notificationLog.findMany({
      where: { topic: campaignTopic(id), success: false },
      select: { id: true, target: true, error: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ])
  const draft = campaign.status === 'DRAFT'
  const input = {
    subject: campaign.subject,
    body: campaign.body,
    postalAddress,
    mailConfigured: mailConfigured(),
    recipients: progress.remaining,
  }
  const problems = sendProblems(input)
  const testProblems = sendProblems(input, { test: true })
  const scan = scanCampaign(campaign.subject, campaign.body)
  const nextCount = Math.min(SHIFT_SIZE, progress.remaining)
  const preview = campaignEmail({
    to: 'preview',
    subject: campaign.subject,
    body: campaign.body,
    unsubscribe: { page: '#unsubscribe', oneClick: '#unsubscribe' },
    postalAddress,
    contactEmail,
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline gap-3">
        <p className="font-display text-xl text-foreground">{campaign.subject}</p>
        <Badge tone={CAMPAIGN_STATUS_TONE[campaign.status] ?? 'neutral'}>
          {campaignStatusLabel(campaign.status)}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Subscribers" value={progress.mailable} hint="active now" />
        <StatCard label="Sent" value={progress.accepted} hint="accepted by the mail service" />
        <StatCard
          label="Failed"
          value={progress.failed}
          {...(progress.failed > 0 ? { tone: 'danger' as const } : {})}
        />
        <StatCard label="Still to go" value={progress.remaining} />
      </div>

      <Panel
        title="Send"
        hint={`In shifts of ${SHIFT_SIZE}, most recent subscribers first; each shift carries on where the last one stopped, and nobody gets it twice. Brevo's free plan sends 300 a day.`}
      >
        {problems.length > 0 && campaign.status !== 'SENT' ? (
          <ul className="mb-4 space-y-1 rounded-md bg-warning-bg p-3 text-sm text-warning-fg">
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        ) : null}
        <div className="flex flex-wrap items-start gap-4">
          {campaign.status === 'SENT' ? (
            <p className="text-sm text-foreground-muted">Everyone on the list has had this blast.</p>
          ) : (
            <SendShiftButton
              action={sendCampaignShift}
              id={campaign.id}
              count={nextCount}
              disabled={problems.length > 0}
            />
          )}
          {session?.email && testProblems.length === 0 ? (
            <SendTestButton action={sendCampaignTest} id={campaign.id} to={session.email} />
          ) : null}
        </div>
      </Panel>

      {scan.warnings.length > 0 ? (
        <Panel title="Worth a second look" hint="The lexicon does not block these, but they are easy to get wrong.">
          <ul className="space-y-2 text-sm">
            {scan.warnings.map((match) => (
              <li key={`${match.term}-${match.index}`}>
                <span className="font-medium text-foreground">{match.term}</span>
                <span className="text-foreground-muted"> — {match.reason}</span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <Panel title="Preview" hint="Exactly what a subscriber receives, apart from their own unsubscribe link.">
        {/* sandbox with no permissions: no scripts, no forms, no navigation out. */}
        <iframe
          title="Email preview"
          sandbox=""
          // The shared footer carries the company-address token, which the mailer fills
          // at send time; the preview is not sent, so it fills it here.
          srcDoc={fillCompanyEmail(preview.html ?? '', contactEmail)}
          className="h-[640px] w-full rounded-md border border-border bg-white"
        />
      </Panel>

      {draft ? (
        <Panel title="Edit" hint="Editable until the first shift goes out. After that the text is fixed.">
          <div className="max-w-2xl">
            <CampaignEditor
              action={updateCampaign}
              id={campaign.id}
              initial={{ name: campaign.name, subject: campaign.subject, body: campaign.body }}
              submitLabel="Save changes"
            />
          </div>
          <div className="mt-6 border-t border-border pt-4">
            <InlineAction
              action={deleteCampaign}
              label="Delete this draft"
              fields={{ id: campaign.id }}
              variant="danger"
              confirm="Delete this draft? It has not been sent to anyone."
            />
          </div>
        </Panel>
      ) : null}

      {failures.length > 0 ? (
        <Panel title="Failed sends" hint="The most recent twenty. Each person is tried once per blast.">
          <ul className="divide-y divide-border text-sm">
            {failures.map((row) => (
              <li key={row.id} className="py-2 first:pt-0">
                <span className="font-medium text-foreground">{row.target}</span>
                <span className="block text-xs text-foreground-muted">{row.error ?? 'unknown error'}</span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  )
}

export default function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <AdminPage
      title="Email blast"
      description="Check the preview, send yourself a test, then send in shifts."
      actions={
        <Link
          href="/admin/campaigns"
          className="inline-flex min-h-11 items-center rounded-md border border-border-strong bg-surface px-3 text-sm font-medium text-foreground hover:bg-surface-sunken"
        >
          All blasts
        </Link>
      }
    >
      <Campaign params={params} />
    </AdminPage>
  )
}
