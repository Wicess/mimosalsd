import { describe, expect, it } from 'vitest'
import { asCounts, sumCounts } from '@/lib/visitors/aggregate'
import { clusterKey, clusterVisitors, type Clusterable } from '@/lib/visitors/clusters'

function visitor(id: string, hoursAgo: number, overrides: Partial<Clusterable> = {}): Clusterable {
  return {
    id,
    country: 'US',
    region: 'TX',
    city: 'Austin',
    device: 'mobile',
    browser: 'Safari',
    os: 'iOS',
    lastSeen: new Date(Date.UTC(2026, 8, 11, 12) - hoursAgo * 3_600_000),
    ...overrides,
  }
}

describe('clusterVisitors', () => {
  it('folds records with the same place and device under the most recent', () => {
    const clusters = clusterVisitors([
      visitor('a', 5),
      visitor('b', 1),
      visitor('c', 3, { city: 'Dallas' }),
      visitor('d', 9),
    ])
    expect(clusters.map((c) => [c.lead.id, c.others.map((o) => o.id)])).toEqual([
      ['b', ['a', 'd']],
      ['c', []],
    ])
  })

  it('never folds on half a fingerprint', () => {
    const noPlace = { city: null, region: null }
    const noDevice = { device: null, browser: null, os: null }
    expect(clusterKey(visitor('a', 1, noPlace))).toBe('solo:a')
    expect(clusterKey(visitor('b', 1, noDevice))).toBe('solo:b')
    expect(clusterVisitors([visitor('a', 1, noPlace), visitor('b', 2, noPlace)])).toHaveLength(2)
  })

  it('ignores case and stray spaces in the fingerprint', () => {
    expect(clusterKey(visitor('a', 1, { city: 'Austin ' }))).toBe(clusterKey(visitor('b', 1, { city: 'austin' })))
  })
})

describe('reading stored counts', () => {
  it('keeps only finite numbers under string keys', () => {
    expect(asCounts({ '/': 3, '/shop': 'x', '/bad': Number.NaN, '/ok': 1 })).toEqual({ '/': 3, '/ok': 1 })
    expect(asCounts(null)).toEqual({})
    expect(asCounts([1, 2])).toEqual({})
    expect(asCounts('{"a":1}')).toEqual({})
  })

  it('adds days together', () => {
    expect(sumCounts([{ '/': 2, '/shop': 1 }, { '/': 1, '/blog': 4 }, {}])).toEqual({ '/': 3, '/shop': 1, '/blog': 4 })
  })
})
