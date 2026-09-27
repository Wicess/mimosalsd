import { NextResponse, type NextRequest } from 'next/server'
import { getAdminIdentity } from '@/lib/admin/auth'
import { canAccessAdminPath } from '@/lib/admin/areas'
import { db } from '@/lib/db/client'

/**
 * Subscriber list export.
 *
 * Auth is re-checked here, not assumed from the admin layout — this is a public HTTP
 * endpoint and it returns email addresses.
 *
 * Exports ACTIVE subscribers by default. Handing a mailing tool a file that silently
 * includes people who unsubscribed is how a business ends up mailing them again, and
 * "the export included them" is not a defence. `?scope=all` is available for a
 * compliance record, and labels the status on every row so the distinction survives
 * the file leaving this system.
 */

/** Prevents a value beginning =, +, - or @ from executing when opened in a spreadsheet. */
function csvCell(value: string): string {
  const escaped = value.replace(/"/g, '""')
  const guarded = /^[=+\-@\t\r]/.test(escaped) ? `'${escaped}` : escaped
  return `"${guarded}"`
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const identity = await getAdminIdentity()
  if (!identity) return new NextResponse('Not authorised', { status: 401 })
  if (!canAccessAdminPath(identity.role, identity.adminAreas, '/admin/newsletter')) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const scope = request.nextUrl.searchParams.get('scope') === 'all' ? 'all' : 'active'

  const rows = await db.newsletterSubscriber.findMany({
    where: scope === 'active' ? { isActive: true } : {},
    orderBy: { createdAt: 'desc' },
    select: {
      email: true,
      source: true,
      isActive: true,
      createdAt: true,
      confirmedAt: true,
      unsubscribedAt: true,
    },
  })

  const header = ['email', 'status', 'source', 'joined', 'confirmed', 'unsubscribed']
  const body = rows.map((r) =>
    [
      r.email,
      r.isActive ? 'active' : 'unsubscribed',
      r.source ?? '',
      r.createdAt.toISOString(),
      r.confirmedAt?.toISOString() ?? '',
      r.unsubscribedAt?.toISOString() ?? '',
    ]
      .map((v) => csvCell(String(v)))
      .join(','),
  )

  const stamp = new Date().toISOString().slice(0, 10)
  return new NextResponse([header.join(','), ...body].join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="subscribers-${scope}-${stamp}.csv"`,
      // Personal data. Never cached anywhere.
      'Cache-Control': 'no-store, private',
    },
  })
}
