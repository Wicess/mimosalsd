import { describe, expect, it } from 'vitest'
import { unsubscribeLinks, unsubscribeToken, verifyUnsubscribeToken } from '@/lib/newsletter/unsubscribe'

const SECRET = 'x'.repeat(40)

describe('unsubscribe tokens', () => {
  it('verify for the subscriber they were made for, and no one else', () => {
    const token = unsubscribeToken('sub_1', SECRET)
    expect(verifyUnsubscribeToken('sub_1', token, SECRET)).toBe(true)
    expect(verifyUnsubscribeToken('sub_2', token, SECRET)).toBe(false)
    expect(verifyUnsubscribeToken('sub_1', token, 'y'.repeat(40))).toBe(false)
  })

  it('refuse anything malformed without throwing', () => {
    expect(verifyUnsubscribeToken('sub_1', '', SECRET)).toBe(false)
    expect(verifyUnsubscribeToken('', unsubscribeToken('', SECRET), SECRET)).toBe(false)
    expect(verifyUnsubscribeToken('sub_1', 'short', SECRET)).toBe(false)
    expect(verifyUnsubscribeToken('sub_1', unsubscribeToken('sub_1', 'short'), 'short')).toBe(false)
  })

  it('build links that carry the id, never an email address', () => {
    const links = unsubscribeLinks('sub_1', SECRET)
    const page = new URL(links.page)
    expect(page.pathname).toBe('/unsubscribe')
    expect(page.searchParams.get('s')).toBe('sub_1')
    expect(verifyUnsubscribeToken('sub_1', page.searchParams.get('t') ?? '', SECRET)).toBe(true)
    expect(new URL(links.oneClick).pathname).toBe('/api/newsletter/unsubscribe')
    expect(links.page).not.toContain('@')
  })
})
