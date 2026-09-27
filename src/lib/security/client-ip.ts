import { isIP } from 'node:net'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  WHO IS ASKING — the client's address, in one spelling.
 *
 *  Used for blocking and for nothing else: no visitor record stores a raw IP.
 *
 *  The blocklist is an exact-match set, so every address is put in one canonical
 *  form before it is stored or compared. Without that, "2001:DB8:0:0::1" typed
 *  into the admin would never match the "2001:db8::1" a request arrives from, and
 *  the block would silently do nothing.
 *
 *  Vercel sets x-forwarded-for itself rather than passing a client's through, so
 *  its first entry is the connecting address; x-real-ip covers other hosts and dev.
 *  Runs in the proxy, so it is plain Node with no server-only imports.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** One canonical spelling of an IP address, or null if the input is not one. */
export function normaliseIp(raw: string): string | null {
  let value = raw.trim().toLowerCase()
  // A bracketed IPv6 literal, as some proxies and log formats write it.
  if (value.startsWith('[') && value.endsWith(']')) value = value.slice(1, -1)
  // IPv4-mapped IPv6 is the same machine as the plain IPv4 address. Mapped here,
  // before the URL parser, which would rewrite it into hex ("::ffff:102:304").
  if (value.startsWith('::ffff:') && isIP(value.slice(7)) === 4) value = value.slice(7)

  const family = isIP(value)
  // Node accepts only strict dotted quads: no leading zeros, no hex, no octal.
  if (family === 4) return value
  if (family === 6) {
    // The WHATWG URL serialiser compresses IPv6 the RFC 5952 way. It refuses a zone
    // id ("fe80::1%eth0"), which never arrives from the internet anyway.
    try {
      return new URL(`http://[${value}]`).hostname.slice(1, -1)
    } catch {
      return null
    }
  }
  return null
}

/** The connecting client's address, canonical, or null when there is none. */
export function clientIpFrom(headers: Pick<Headers, 'get'>): string | null {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const raw = forwarded || headers.get('x-real-ip')?.trim()
  return raw ? normaliseIp(raw) : null
}
