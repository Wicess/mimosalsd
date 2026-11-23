/**
 * Lightweight UA + referer parsing helpers. No external deps.
 */

export type UAInfo = { device: string; browser: string; os: string };

export function parseUserAgent(ua: string | null | undefined): UAInfo {
  const s = (ua ?? "").toLowerCase();

  let device = "desktop";
  if (/ipad|tablet/.test(s)) device = "tablet";
  else if (/mobile|android|iphone|ipod/.test(s)) device = "mobile";

  let browser = "Other";
  if (/edg\//.test(s)) browser = "Edge";
  else if (/opr\/|opera/.test(s)) browser = "Opera";
  else if (/chrome|crios/.test(s)) browser = "Chrome";
  else if (/firefox|fxios/.test(s)) browser = "Firefox";
  else if (/safari/.test(s)) browser = "Safari";

  let os = "Other";
  if (/windows/.test(s)) os = "Windows";
  else if (/iphone|ipad|ipod/.test(s)) os = "iOS";
  else if (/android/.test(s)) os = "Android";
  else if (/mac os x|macintosh/.test(s)) os = "macOS";
  else if (/linux/.test(s)) os = "Linux";

  return { device, browser, os };
}

export function extractRefererDomain(
  referer: string | null | undefined,
): string | null {
  if (!referer) return null;
  try {
    return new URL(referer).hostname;
  } catch {
    return null;
  }
}

/** Returns sessionId derived from the `wham_cart` cookie (set in middleware). */
export function readSessionId(
  cookieValue: string | null | undefined,
): string | null {
  return cookieValue?.trim() || null;
}

/** Percent delta with sane handling of zero baselines. */
export function deltaPct(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}
