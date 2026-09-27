/**
 * The anonymous visitor cookie, shared by live chat and visit tracking so that a
 * chat thread and the visits behind it are the same visitor.
 *
 * It is a random id and nothing else. It is also what chat uses to find a
 * visitor's thread, which makes it a bearer value: never render it in full, and
 * never put it in a URL (the admin addresses visitors by row id instead).
 *
 * Plain module, no server-only imports: the proxy reads and mints it.
 */
export const VISITOR_COOKIE = 'visitor'
export const VISITOR_MAX_AGE = 60 * 60 * 24 * 90

const VISITOR_ID = /^[0-9a-f-]{36}$/i

export function isVisitorId(value: string | null | undefined): value is string {
  return typeof value === 'string' && VISITOR_ID.test(value)
}
