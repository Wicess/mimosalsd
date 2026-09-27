'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { unsubscribeWithToken } from '@/lib/newsletter/unsubscribe-store'

/**
 * The button on /unsubscribe. Public, so it trusts nothing: the link's signed
 * token is checked again here rather than taken from the page that rendered it.
 */
const Input = z.object({
  s: z.string().min(1).max(64),
  t: z.string().min(1).max(128),
})

export async function unsubscribe(formData: FormData): Promise<void> {
  const parsed = Input.safeParse({ s: formData.get('s'), t: formData.get('t') })
  if (!parsed.success) redirect('/unsubscribe?status=invalid')
  const outcome = await unsubscribeWithToken(parsed.data.s, parsed.data.t)
  redirect(`/unsubscribe?status=${outcome}`)
}
