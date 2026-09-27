/** How a blast's status reads in the admin: the list and the detail page alike. */
export const CAMPAIGN_STATUS_TONE: Record<string, 'neutral' | 'warning' | 'success' | 'danger' | 'info'> = {
  DRAFT: 'neutral',
  IN_PROGRESS: 'info',
  SENDING: 'warning',
  SENT: 'success',
  FAILED: 'danger',
}

export function campaignStatusLabel(status: string): string {
  return (
    { DRAFT: 'draft', IN_PROGRESS: 'part sent', SENDING: 'sending', SENT: 'sent', FAILED: 'failed' }[status] ??
    status.toLowerCase()
  )
}
