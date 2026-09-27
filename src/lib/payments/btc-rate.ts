import 'server-only'

/**
 * The current USD price of one bitcoin, for pre-filling the BTC amount on the
 * payment-details form. The owner sees the figure and can change it before sending;
 * it is a convenience, never a silent input.
 *
 * Two public, keyless sources in turn (Coinbase, then Kraken), each with a short
 * timeout, and the answer cached for a minute: the form is opened from a phone
 * notification and should not wait on an exchange. When neither answers, the result
 * is null and the owner types the amount.
 */
let cached: { usd: number; at: number; source: string } | undefined

export async function bitcoinUsdRate(): Promise<{ usd: number; source: string; at: string } | null> {
  if (cached && Date.now() - cached.at < 60_000) {
    return { usd: cached.usd, source: cached.source, at: new Date(cached.at).toISOString() }
  }
  const sources: { name: string; url: string; read: (json: unknown) => number }[] = [
    {
      name: 'Coinbase',
      url: 'https://api.coinbase.com/v2/prices/BTC-USD/spot',
      read: (json) => Number((json as { data?: { amount?: string } }).data?.amount),
    },
    {
      name: 'Kraken',
      url: 'https://api.kraken.com/0/public/Ticker?pair=XBTUSD',
      read: (json) => {
        const result = (json as { result?: Record<string, { c?: [string] }> }).result ?? {}
        return Number(Object.values(result)[0]?.c?.[0])
      },
    },
  ]
  for (const source of sources) {
    try {
      const response = await fetch(source.url, { signal: AbortSignal.timeout(3000), cache: 'no-store' })
      if (!response.ok) continue
      const usd = source.read(await response.json())
      // A sanity band, so a malformed answer can never price an order at $0.01 a coin.
      if (Number.isFinite(usd) && usd > 1_000 && usd < 10_000_000) {
        cached = { usd, at: Date.now(), source: source.name }
        return { usd, source: source.name, at: new Date(cached.at).toISOString() }
      }
    } catch {
      // Try the next source.
    }
  }
  return null
}
