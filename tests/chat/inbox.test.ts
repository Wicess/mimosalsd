import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { mergeMessages } from '@/components/admin/chat/merge'
import type { InboxMessage, InboxReceipt } from '@/components/admin/chat/types'
import { EMOJIS } from '@/components/chat/emoji'
import { scanText } from '@/lib/compliance/lexicon'

/**
 * The operator's inbox: how a poll folds into the conversation on screen, and the
 * guarantees around it that are easy to break by accident.
 */

function msg(id: string, overrides: Partial<InboxMessage> = {}): InboxMessage {
  return {
    id,
    sender: 'ADMIN',
    body: `body ${id}`,
    createdAt: `2026-09-11T10:00:0${id.replace(/\D/g, '') || '0'}.000Z`,
    attachment: null,
    edited: false,
    deleted: false,
    authorName: null,
    deliveredAt: null,
    readAt: null,
    ...overrides,
  }
}

function receipt(id: string, overrides: Partial<InboxReceipt> = {}): InboxReceipt {
  return { id, body: `body ${id}`, deliveredAt: null, readAt: null, edited: false, deleted: false, ...overrides }
}

describe('mergeMessages', () => {
  it('replaces on a full load, dropping removed rows', () => {
    const next = mergeMessages([msg('m1')], [msg('m2'), msg('m3', { deleted: true })], [], true)
    expect(next.map((m) => m.id)).toEqual(['m2'])
  })

  it('merges new rows by id, in time order', () => {
    const next = mergeMessages([msg('m1'), msg('m3')], [msg('m2')], [], false)
    expect(next.map((m) => m.id)).toEqual(['m1', 'm2', 'm3'])
  })

  it('lets a later copy of a held message win', () => {
    const next = mergeMessages([msg('m1', { body: 'old' })], [msg('m1', { body: 'new', edited: true })], [], false)
    expect(next).toHaveLength(1)
    expect(next[0]).toMatchObject({ body: 'new', edited: true })
  })

  it('drops the optimistic twin when the poll echoes the reply first', () => {
    const pending = msg('pending-1', { body: 'On its way', pending: true, createdAt: '2026-09-11T10:00:09.000Z' })
    const next = mergeMessages([msg('m1'), pending], [msg('m2', { body: 'On its way' })], [], false)
    expect(next.map((m) => m.id)).toEqual(['m1', 'm2'])
  })

  it('keeps an optimistic attachment — its twin cannot be matched by text', () => {
    const pending = msg('pending-1', { body: '', pending: true, attachment: { type: 'image/png', name: 'a.png' } })
    const next = mergeMessages([pending], [msg('m2', { body: '' })], [], false)
    expect(next.map((m) => m.id)).toContain('pending-1')
  })

  it('applies receipts to messages already on screen', () => {
    const prev = [msg('m1'), msg('m2')]
    const next = mergeMessages(prev, [], [receipt('m1', { deliveredAt: 'd', readAt: 'r' })], false)
    expect(next[0]).toMatchObject({ deliveredAt: 'd', readAt: 'r' })
    expect(next[1]).toBe(prev[1])
  })

  it('carries a correction and a removal made in another tab', () => {
    const prev = [msg('m1'), msg('m2')]
    const next = mergeMessages(
      prev,
      [],
      [receipt('m1', { body: 'fixed', edited: true }), receipt('m2', { deleted: true })],
      false,
    )
    expect(next).toHaveLength(1)
    expect(next[0]).toMatchObject({ id: 'm1', body: 'fixed', edited: true })
  })

  it('returns the SAME array when nothing changed, so React skips the render', () => {
    const prev = [msg('m1', { deliveredAt: 'd' })]
    expect(mergeMessages(prev, [], [], false)).toBe(prev)
    expect(mergeMessages(prev, [], [receipt('m1', { deliveredAt: 'd' })], false)).toBe(prev)
  })
})

describe('the emoji tray', () => {
  it('carries nothing that implies smoking or consumption', () => {
    // WHAM's set, in a THC shop, includes these. On products sold as not for human
    // consumption, the business must not imply it in writing — emoji included.
    for (const banned of ['💨', '🍃', '🌿', '🥦', '💸', '🔥', '🍄', '💊', '🚬']) {
      expect(EMOJIS).not.toContain(banned)
    }
  })

  it('has no duplicates and fills its 8-column grid', () => {
    expect(new Set(EMOJIS).size).toBe(EMOJIS.length)
    expect(EMOJIS.length % 8).toBe(0)
  })
})

/*
 * Every admin chat endpoint serves customers' private conversations over plain HTTP.
 * The admin layout protects the PAGE, and says nothing about who calls an API route
 * directly — so every exported handler must run the guard itself. A route added
 * without it fails here, not in production.
 */
function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) return routeFiles(full)
    return entry === 'route.ts' ? [full] : []
  })
}

describe('admin chat routes', () => {
  const files = routeFiles(path.resolve(__dirname, '../../src/app/api/admin/chat'))

  it('exist', () => {
    expect(files.length).toBeGreaterThanOrEqual(4)
  })

  it.each(files.map((f) => [path.relative(process.cwd(), f), f]))('%s guards every handler', (_name, file) => {
    const source = readFileSync(file, 'utf8')
    const handlers = source.match(/export async function (GET|POST|PUT|PATCH|DELETE)\b/g) ?? []
    const guards = source.match(/await requireChatAdmin\(\)/g) ?? []
    expect(handlers.length).toBeGreaterThan(0)
    expect(guards.length).toBeGreaterThanOrEqual(handlers.length)
  })
})

describe('operator replies', () => {
  it('the lexicon the reply gate uses blocks a health claim', () => {
    // checkOperatorReply is scanText in a wrapper; if this stops blocking, so does the gate.
    expect(scanText('Yes, it will help your depression.').clean).toBe(false)
    expect(scanText('Your order ships tomorrow.').clean).toBe(true)
  })
})

/*
 * Loaded here rather than inside the test: lib/chat/core pulls in the database client
 * and the lexicon, and on a loaded machine that import alone can outlast the 5s test
 * timeout — a flake that says nothing about the gate.
 */
const { checkOperatorReply } = await import('@/lib/chat/core')

describe('the operator reply gate', () => {
  it('cannot be switched off by a directive typed into the reply', () => {
    const smuggled = '<!-- compliance-allow: cure -- quoting the customer --> This will cure it.'
    // The directive is well-formed: where directives ARE honoured, it clears the term…
    expect(scanText(smuggled).clean).toBe(true)
    // …and the reply gate ignores it anyway.
    expect(checkOperatorReply(smuggled).ok).toBe(false)
    expect(checkOperatorReply('This will cure it.').ok).toBe(false)
    expect(checkOperatorReply('Your order ships tomorrow.').ok).toBe(true)
  })
})
