import { describe, expect, it } from 'vitest'
import { isQuietPath } from '@/components/pwa/quiet-paths'

describe('isQuietPath: where the subscribe and install pop-ups never show', () => {
  it('keeps checkout, the cart, order pages and the account free of pop-ups', () => {
    for (const path of ['/checkout', '/checkout/', '/cart', '/order/abc123', '/account', '/account/subscription']) {
      expect(isQuietPath(path), path).toBe(true)
    }
  })
  it('still allows them on ordinary pages', () => {
    for (const path of ['/', '/shop', '/product/mimosa-hostilis-root-bark-powder', '/blog', '/checkouts-explained']) {
      expect(isQuietPath(path), path).toBe(false)
    }
  })
})
