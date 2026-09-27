import { NextResponse, type NextRequest } from 'next/server'
import { isAuthenticated } from '@/lib/admin/auth'
import { buildPactReports, toCsv } from '@/lib/compliance/pact-report'

/**
 * PACT report CSV download.
 *
 * Auth is re-checked here, not assumed from the admin layout — this is a public HTTP
 * endpoint, and it returns customer names and home addresses.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!(await isAuthenticated())) {
    return new NextResponse('Not authorised', { status: 401 })
  }

  const params = request.nextUrl.searchParams
  const year = Number(params.get('year'))
  const month = Number(params.get('month'))
  const stateCode = params.get('state')

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return new NextResponse('Invalid period', { status: 400 })
  }

  const reports = await buildPactReports(year, month)
  const report = reports.find((r) => r.stateCode === stateCode)
  if (!report) return new NextResponse('No deliveries for that state and period', { status: 404 })

  const period = `${year}-${String(month).padStart(2, '0')}`
  return new NextResponse(toCsv(report), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="pact-${report.stateCode}-${period}.csv"`,
      // Contains PII. Never cached anywhere.
      'Cache-Control': 'no-store, private',
    },
  })
}
