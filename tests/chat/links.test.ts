import { describe, expect, it } from 'vitest'
import { splitLinks } from '@/lib/chat/links'

const links = (body: string) => splitLinks(body).filter((p) => p.kind === 'link')

describe('splitLinks', () => {
  it('makes a pasted Cash App link clickable, with or without https', () => {
    expect(links('Pay here: https://cash.app/$MimosaShop/135')).toEqual([
      { kind: 'link', text: 'https://cash.app/$MimosaShop/135', href: 'https://cash.app/$MimosaShop/135' },
    ])
    expect(links('Pay at cash.app/$MimosaShop')).toEqual([
      { kind: 'link', text: 'cash.app/$MimosaShop', href: 'https://cash.app/$MimosaShop' },
    ])
  })

  it('opens www links over https', () => {
    expect(links('see www.example.com/track')[0]).toMatchObject({ href: 'https://www.example.com/track' })
  })

  it('keeps sentence punctuation and a closing bracket out of the link', () => {
    const parts = splitLinks('Pay at cash.app/$Shop. Thanks (or https://x.com/a).')
    expect(links('Pay at cash.app/$Shop. Thanks (or https://x.com/a).').map((p) => p.text)).toEqual([
      'cash.app/$Shop',
      'https://x.com/a',
    ])
    // Nothing is lost: the parts put back together are the message.
    expect(parts.map((p) => p.text).join('')).toBe('Pay at cash.app/$Shop. Thanks (or https://x.com/a).')
  })

  it('keeps a bracket that the link itself opened', () => {
    expect(links('https://en.wikipedia.org/wiki/Mimosa_(plant)')[0]?.text).toBe('https://en.wikipedia.org/wiki/Mimosa_(plant)')
  })

  it('never links a bare $Cashtag, an amount, or a non-http scheme', () => {
    expect(links('A typo in the $Cashtag sends $135 to someone else.')).toEqual([])
    expect(links('javascript:alert(1) data:text/html,hi')).toEqual([])
    expect(links('mycash.app/$x')).toEqual([])
  })

  it('returns plain text untouched when there is no link', () => {
    expect(splitLinks('Hello there')).toEqual([{ kind: 'text', text: 'Hello there' }])
  })

  it('handles several links and line breaks', () => {
    const body = 'Cash App: https://cash.app/$A\nTracking: https://tools.usps.com/go/TrackConfirmAction?tLabels=9400'
    expect(links(body).map((p) => p.text)).toEqual([
      'https://cash.app/$A',
      'https://tools.usps.com/go/TrackConfirmAction?tLabels=9400',
    ])
  })
})
