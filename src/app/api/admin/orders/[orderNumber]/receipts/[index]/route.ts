import { NextResponse } from 'next/server'
import { getAdminIdentity } from '@/lib/admin/auth'
import { canAccessAdminPath } from '@/lib/admin/areas'
import { db } from '@/lib/db/client'
import { signedUrl } from '@/lib/storage/r2'

/**
 * Open one of a customer's payment receipts.
 *
 * Redirects to a signed R2 URL that expires in two minutes — long enough to load the
 * image, short enough that a URL pasted into a chat or left in browser history is
 * dead by the time anyone else tries it. The receipts themselves are never public.
 *
 * The key is looked up from the ORDER, by index, and never accepted from the request.
 * An endpoint that signed whatever key it was handed would be a way for anyone who
 * can reach it to read any private object in the bucket — including other customers'
 * receipts — by guessing a path.
 *
 * Auth and the orders-area grant are both re-checked here. This is a public HTTP
 * endpoint, and it returns a picture of somebody's bank account.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orderNumber: string; index: string }> },
) {
  const identity = await getAdminIdentity()
  if (!identity) return new NextResponse('Not signed in', { status: 401 })
  if (!canAccessAdminPath(identity.role, identity.adminAreas, '/admin/orders')) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const { orderNumber, index: rawIndex } = await params
  const index = Number(rawIndex)
  if (!Number.isInteger(index) || index < 0 || index > 50) {
    return new NextResponse('Not found', { status: 404 })
  }

  const order = await db.order.findUnique({
    where: { orderNumber },
    select: { paymentRequest: { select: { receiptKeys: true } } },
  })
  const key = order?.paymentRequest?.receiptKeys[index]
  if (!key) return new NextResponse('Not found', { status: 404 })

  const url = await signedUrl(key, 120)
  return NextResponse.redirect(url, {
    status: 302,
    // The redirect target is itself a credential. Nothing should keep it.
    headers: { 'Cache-Control': 'no-store, private', 'Referrer-Policy': 'no-referrer' },
  })
}
