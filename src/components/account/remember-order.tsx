'use client'

import { useEffect } from 'react'

export const ORDER_TOKENS_KEY = 'sg-order-tokens'

/** The private order links this browser has opened, newest first. */
export function readRememberedTokens(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(ORDER_TOKENS_KEY) ?? '[]') as unknown
    return Array.isArray(value) ? value.filter((token): token is string => typeof token === 'string').slice(0, 20) : []
  } catch {
    return []
  }
}

/**
 * Opening an order's page on this device puts that order in the profile's Orders,
 * so a customer who ordered on their laptop and opens the email on their phone sees
 * it there too, without signing in.
 */
export function RememberOrder({ token }: { token: string }) {
  useEffect(() => {
    try {
      const tokens = [token, ...readRememberedTokens().filter((t) => t !== token)].slice(0, 20)
      localStorage.setItem(ORDER_TOKENS_KEY, JSON.stringify(tokens))
    } catch {
      // Storage blocked: the orders placed from this browser still show.
    }
  }, [token])
  return null
}
