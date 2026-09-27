'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getAdminIdentity } from '@/lib/admin/auth'
import { canAccessAdminPath } from '@/lib/admin/areas'
import { ORDER_ID_PATTERN } from '@/lib/orders/repository'
import { issuePaymentDetails } from '@/lib/payments/issue'

export interface SendPaymentDetailsState {
  readonly error?: string
  readonly field?: 'payTo' | 'btcAmount' | 'method'
  readonly sent?: {
    readonly reissued: boolean
    readonly chat: 'sent' | 'no-chat' | 'failed'
    readonly email: 'sent' | 'failed'
    readonly invoiceAttached: boolean
    readonly headline: string
    readonly summary: readonly { readonly label: string; readonly value: string }[]
  }
}

const schema = z.object({
  orderNumber: z.string().trim().regex(ORDER_ID_PATTERN, 'Invalid Order ID.'),
  method: z.enum(['CASHAPP', 'CHIME', 'APPLE_CASH', 'BITCOIN']),
  payTo: z.string().trim().min(1, 'Enter where the customer should pay.').max(120),
  payToName: z.string().trim().max(80).optional(),
  btcAmount: z.string().trim().max(24).optional(),
  btcRateUsd: z.coerce.number().positive().max(10_000_000).optional(),
  btcQuoteMinutes: z.coerce.number().int().min(15).max(1440).optional(),
})

/** The Send button on /admin/orders/[slug]/payment. The work is in lib/payments/issue.ts. */
export async function sendPaymentDetails(
  _previous: SendPaymentDetailsState,
  formData: FormData,
): Promise<SendPaymentDetailsState> {
  const identity = await getAdminIdentity()
  if (!identity) return { error: 'Your session has ended. Sign in again, then send.' }
  if (!canAccessAdminPath(identity.role, identity.adminAreas, '/admin/orders')) {
    return { error: 'You do not have access to orders.' }
  }

  const blankToUndefined = (value: FormDataEntryValue | null) =>
    typeof value === 'string' && value.trim() !== '' ? value : undefined
  const parsed = schema.safeParse({
    orderNumber: formData.get('orderNumber'),
    method: formData.get('method'),
    payTo: formData.get('payTo'),
    payToName: blankToUndefined(formData.get('payToName')),
    btcAmount: blankToUndefined(formData.get('btcAmount')),
    btcRateUsd: blankToUndefined(formData.get('btcRateUsd')),
    btcQuoteMinutes: blankToUndefined(formData.get('btcQuoteMinutes')),
  })
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return {
      error: issue?.message ?? 'Check the details and try again.',
      ...(issue?.path[0] === 'payTo' ? { field: 'payTo' as const } : {}),
    }
  }

  const result = await issuePaymentDetails({ ...parsed.data, actorEmail: identity.email })
  if (!result.ok) return { error: result.error, ...(result.field ? { field: result.field } : {}) }

  revalidatePath(`/admin/orders/${result.orderNumber}`)
  revalidatePath(`/admin/orders/${result.orderNumber}/payment`)
  revalidatePath('/admin/orders')
  return {
    sent: {
      reissued: result.reissued,
      chat: result.chat,
      email: result.email,
      invoiceAttached: result.invoiceAttached,
      headline: result.instructions.headline,
      summary: result.instructions.summary,
    },
  }
}
