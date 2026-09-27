/**
 * The largest file an admin upload may be, in bytes.
 *
 * 4 MB, and the ceiling is not ours to raise. Vercel refuses any function
 * request body over 4.5 MB before our code runs, so a higher limit here would
 * only move the failure to a platform error page. The server-action body limit
 * in next.config.ts is set to match, with room for multipart overhead.
 */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024
