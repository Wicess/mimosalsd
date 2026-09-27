import type { Instrumentation } from 'next'

/**
 * Every server-side error, in one place.
 *
 * This is the backbone of the error handling and the reason the rest of it can stay
 * thin. Next calls this for anything that throws during a render, a route handler, a
 * Server Action or the proxy — including errors nobody wrote a `try` around, which are
 * precisely the ones that used to disappear. Without it, an error boundary can show a
 * customer a friendly page while no one is ever told the page broke.
 *
 * `routeType` tells us WHERE it happened, and it is worth keeping distinct: an
 * `action` failure means a customer's submission was lost, while a `render` failure
 * usually means a page is down for everyone. They deserve different urgency.
 */
export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context,
) => {
  // Loaded lazily so the reporter's Prisma dependency is not pulled into a bundle that
  // will never write — and so an import failure here cannot break server startup.
  const { reportError } = await import('@/lib/observability/report-error')

  const source =
    context.routeType === 'route'
      ? 'route'
      : context.routeType === 'action'
        ? 'action'
        : context.routeType === 'proxy'
          ? 'proxy'
          : 'render'

  await reportError(err, {
    source,
    // The request died. Everything reaching this hook is already unhandled.
    severity: 'FATAL',
    routePath: context.routePath,
    requestPath: request.path,
    method: request.method,
    context: {
      routerKind: context.routerKind,
      routeType: context.routeType,
      ...(context.renderSource ? { renderSource: context.renderSource } : {}),
      ...(context.revalidateReason ? { revalidateReason: context.revalidateReason } : {}),
      // The referer turns "a page is broken" into "a page is broken and here is the
      // link people are arriving from". No other header is recorded: they carry
      // cookies and authorization.
      ...(typeof request.headers.referer === 'string'
        ? { referer: request.headers.referer }
        : {}),
    },
  })
}
