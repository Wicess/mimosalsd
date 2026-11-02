/**
 * Where the live-chat "something changed" pings travel: the public ntfy.sh server,
 * free, which holds the long-lived connection so that neither Vercel nor Neon has to.
 *
 * Shared by the server (which publishes) and the browser (which listens). It is also
 * the one origin added to the CSP's connect-src in src/proxy.ts.
 */
export const LIVE_PUSH_ORIGIN = 'https://ntfy.sh'
