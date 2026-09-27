import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  cleanBody,
  customerVisibleReceipt,
  deriveDisplayName,
  isRecent,
  MAX_BODY,
  newPublicId,
  previewLine,
} from '@/lib/chat/rules'
import { forAdmin, forCustomer, type StoredMessage } from '@/lib/chat/serialize'

/**
 * Live chat — everything that decides what a customer and an operator see.
 *
 * The rule with teeth is the receipt rule: a customer sees ONE tick, never the moment
 * the shop read their message. It is asserted twice — in the rule, and in the wire
 * shape, where `readAt` must be absent rather than merely empty.
 */

describe('newPublicId', () => {
  it('is SG- plus five characters from the read-aloud alphabet', () => {
    for (let i = 0; i < 500; i++) {
      const id = newPublicId()
      expect(id).toMatch(/^SG-[23456789ABCDEFGHJKMNPQRSTVWXYZ]{5}$/)
      // The letters that get misheard or misread down a phone line never appear.
      expect(id.slice(3)).not.toMatch(/[ILOU01]/)
    }
  })

  it('does not repeat in practice', () => {
    const seen = new Set(Array.from({ length: 2000 }, () => newPublicId()))
    expect(seen.size).toBeGreaterThan(1990)
  })
})

describe('deriveDisplayName', () => {
  it('prefers a given name', () => {
    expect(deriveDisplayName({ name: '  Ines Lopez ', email: 'x@y.com', publicId: 'SG-AAAAA' })).toBe('Ines Lopez')
  })

  it('title-cases an email local part, dropping digits and separators', () => {
    expect(deriveDisplayName({ email: 'james.okafor92@example.com' })).toBe('James Okafor')
    expect(deriveDisplayName({ email: 'sam_carter+shop@example.com' })).toBe('Sam Carter Shop')
  })

  it('keeps an email local part that has no usable words', () => {
    expect(deriveDisplayName({ email: '1234@example.com' })).toBe('1234')
  })

  it('degrades to the handle, never to an anonymous label, when it can', () => {
    expect(deriveDisplayName({ publicId: 'SG-7K3M9' })).toBe('SG-7K3M9')
    expect(deriveDisplayName({ email: 'not-an-email', publicId: 'SG-7K3M9' })).toBe('SG-7K3M9')
  })

  it('says Visitor only when there is nothing at all', () => {
    expect(deriveDisplayName({})).toBe('Visitor')
  })

  it('caps length', () => {
    expect(deriveDisplayName({ name: 'x'.repeat(200) })).toHaveLength(80)
  })
})

describe('cleanBody', () => {
  it('rejects non-strings and empties', () => {
    expect(cleanBody(undefined)).toBeNull()
    expect(cleanBody(42)).toBeNull()
    expect(cleanBody('   \n\t  ')).toBeNull()
  })

  it('normalises line endings and trims', () => {
    expect(cleanBody('  hello\r\nthere\rfriend  ')).toBe('hello\nthere\nfriend')
  })

  it('strips control characters but keeps newlines and tabs', () => {
    expect(cleanBody('a\u0000b\u0007c\u001fd\n\te')).toBe('abcd\n\te')
  })

  it('caps the length at MAX_BODY', () => {
    expect(cleanBody('y'.repeat(MAX_BODY + 50))).toHaveLength(MAX_BODY)
  })
})

describe('isRecent', () => {
  afterEach(() => vi.useRealTimers())

  it('is false for nothing and for garbage', () => {
    expect(isRecent(null, 1000)).toBe(false)
    expect(isRecent(undefined, 1000)).toBe(false)
    expect(isRecent('not a date', 1000)).toBe(false)
  })

  it('compares against the window, for Dates and ISO strings alike', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-11T12:00:00Z'))
    expect(isRecent(new Date('2026-09-11T11:59:59.500Z'), 1000)).toBe(true)
    expect(isRecent('2026-09-11T11:59:58.000Z', 1000)).toBe(false)
  })
})

describe('customerVisibleReceipt', () => {
  it('is one tick: delivered or not, and never "read"', () => {
    expect(customerVisibleReceipt({ deliveredAt: null })).toBe('sent')
    expect(customerVisibleReceipt({ deliveredAt: new Date() })).toBe('delivered')
  })
})

describe('previewLine', () => {
  it('uses the text, trimmed and capped', () => {
    expect(previewLine('  hi  ')).toBe('hi')
    expect(previewLine('z'.repeat(400))).toHaveLength(300)
  })

  it('names an attachment when there is no text', () => {
    expect(previewLine('', 'application/pdf')).toBe('PDF attached')
    expect(previewLine('', 'image/png')).toBe('Photo attached')
    expect(previewLine('')).toBe('')
  })
})

function stored(overrides: Partial<StoredMessage> = {}): StoredMessage {
  return {
    id: 'm1',
    fromCustomer: false,
    isSystem: false,
    body: 'Your order has shipped.',
    authorName: 'Operator',
    createdAt: new Date('2026-09-11T10:00:00Z'),
    deliveredAt: new Date('2026-09-11T10:00:05Z'),
    readAt: new Date('2026-09-11T10:01:00Z'),
    attachmentKey: null,
    attachmentType: null,
    attachmentName: null,
    editedAt: null,
    deletedAt: null,
    ...overrides,
  }
}

describe('forCustomer / forAdmin', () => {
  it('never puts readAt on the wire to a customer — absent, not empty', () => {
    const wire = forCustomer(stored())
    expect('readAt' in wire).toBe(false)
    expect(JSON.stringify(wire)).not.toContain('readAt')
    expect(wire.receipt).toBe('delivered')
  })

  it('gives the operator both ticks', () => {
    const wire = forAdmin(stored())
    expect(wire.readAt).toBe('2026-09-11T10:01:00.000Z')
    expect(wire.deliveredAt).toBe('2026-09-11T10:00:05.000Z')
    expect(wire.authorName).toBe('Operator')
  })

  it('maps the sender, with SYSTEM taking precedence', () => {
    expect(forCustomer(stored({ fromCustomer: true })).sender).toBe('CUSTOMER')
    expect(forCustomer(stored()).sender).toBe('ADMIN')
    expect(forCustomer(stored({ isSystem: true, fromCustomer: false })).sender).toBe('SYSTEM')
  })

  it('never exposes a storage key — only a type and a display name', () => {
    const wire = forCustomer(
      stored({ attachmentKey: 'private/chat/t1/abc.png', attachmentType: 'image/png', attachmentName: 'receipt.png' }),
    )
    expect(wire.attachment).toEqual({ type: 'image/png', name: 'receipt.png' })
    expect(JSON.stringify(wire)).not.toContain('private/chat')
    expect(JSON.stringify(forAdmin(stored({ attachmentKey: 'private/chat/t1/abc.png', attachmentType: 'image/png' })))).not.toContain(
      'private/chat',
    )
  })

  it('empties a removed message for both audiences', () => {
    const removed = stored({
      deletedAt: new Date(),
      attachmentKey: 'private/chat/t1/abc.png',
      attachmentType: 'image/png',
    })
    for (const wire of [forCustomer(removed), forAdmin(removed)]) {
      expect(wire.deleted).toBe(true)
      expect(wire.body).toBe('')
      expect(wire.attachment).toBeNull()
    }
  })

  it('marks an edit', () => {
    expect(forCustomer(stored({ editedAt: new Date() })).edited).toBe(true)
    expect(forCustomer(stored()).edited).toBe(false)
  })
})
