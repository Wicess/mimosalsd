import Link from 'next/link'
import { AdminPage } from '@/components/admin/shell'
import { CampaignEditor } from '@/components/admin/campaign-forms'
import { createCampaign } from '@/app/actions/admin-campaigns'

export const metadata = { title: 'New email blast' }

export default function NewCampaignPage() {
  return (
    <AdminPage
      title="New email blast"
      description="Saved as a draft. Nothing is sent until you send it from the next page, where you can preview it and send yourself a test first."
      actions={
        <Link
          href="/admin/campaigns"
          className="inline-flex min-h-11 items-center rounded-md border border-border-strong bg-surface px-3 text-sm font-medium text-foreground hover:bg-surface-sunken"
        >
          All blasts
        </Link>
      }
    >
      <div className="max-w-2xl">
        <CampaignEditor action={createCampaign} submitLabel="Save draft" />
      </div>
    </AdminPage>
  )
}
