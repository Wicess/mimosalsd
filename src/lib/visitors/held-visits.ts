import 'server-only'
import { randomUUID } from 'node:crypto'
import { deleteObjects, getObjectText, isConfigured, listKeys, putObject } from '@/lib/storage/r2'
import { parseVisitEvent, type VisitEvent } from './page-view'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  WHERE PAGE VIEWS WAIT — in object storage, so the database can sleep.
 *
 *  Neon bills for every minute the database is awake and suspends only after
 *  about five minutes with no query at all. Page views used to be written to
 *  Postgres a batch at a time, within seconds of arriving, so every crawler that
 *  touched the site woke the database, and crawlers arrive around the clock.
 *
 *  A batch is now one small JSON object in R2, which costs nothing to leave
 *  there. The nightly filing (lib/visitors/flush.ts) reads the finished day's
 *  objects, writes the visitor rows and daily counts in one go, and deletes
 *  them. Nothing is dropped: the same events reach the same tables, once a day
 *  instead of all day (owner's rule: reduce how often data is written, never
 *  drop it).
 *
 *  Postgres stays the fallback. With R2 not configured, or a write refused, the
 *  batch goes to the VisitEvent table as before, and the filing reads both.
 *
 *  Keys sit under `private/`, which lib/storage/r2.ts never serves publicly:
 *  an event carries a visitor's city and coordinates.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const PREFIX = 'private/visits/'
const dayPrefix = (dayIso: string) => `${PREFIX}${dayIso}/`
const dayOfEvent = (event: VisitEvent) => new Date(event.t).toISOString().slice(0, 10)

/** Reads at a time. Enough to be quick, few enough not to flood the connection pool. */
const READ_CONCURRENCY = 24

export function holdingConfigured(): boolean {
  return isConfigured()
}

/** Store a batch, one object per UTC day it touches. Throws if R2 refuses. */
export async function holdEvents(events: readonly VisitEvent[]): Promise<void> {
  const byDay = new Map<string, VisitEvent[]>()
  for (const event of events) {
    const day = dayOfEvent(event)
    byDay.set(day, [...(byDay.get(day) ?? []), event])
  }
  await Promise.all(
    [...byDay].map(([day, batch]) =>
      putObject(`${dayPrefix(day)}${Date.now()}-${randomUUID()}.json`, JSON.stringify(batch), 'application/json'),
    ),
  )
}

/** Days with objects waiting, oldest first. */
export async function heldDays(): Promise<string[]> {
  if (!holdingConfigured()) return []
  const days = new Set<string>()
  for (const key of await listKeys(PREFIX)) {
    const day = key.slice(PREFIX.length, PREFIX.length + 10)
    if (/^\d{4}-\d{2}-\d{2}$/.test(day)) days.add(day)
  }
  return [...days].sort()
}

/*
  An object is written once and never changed, so what one read learned stays true.
  Kept per server instance: the admin's visitor page re-reads today on every load,
  and this makes the second load fetch only what arrived since the first.
*/
const seen = new Map<string, readonly VisitEvent[]>()
const SEEN_LIMIT = 4_000

async function readObject(key: string): Promise<readonly VisitEvent[]> {
  const known = seen.get(key)
  if (known) return known
  const text = await getObjectText(key)
  let batch: unknown = []
  try {
    batch = text ? JSON.parse(text) : []
  } catch {
    batch = []
  }
  const events = (Array.isArray(batch) ? batch : [])
    .map((event) => parseVisitEvent(JSON.stringify(event)))
    .filter((event): event is VisitEvent => event !== null)
  if (seen.size >= SEEN_LIMIT) seen.clear()
  seen.set(key, events)
  return events
}

/** A day's waiting events, and the keys they came from (for clearing once filed). */
export async function readHeldDay(dayIso: string): Promise<{ events: VisitEvent[]; keys: string[] }> {
  if (!holdingConfigured()) return { events: [], keys: [] }
  const keys = await listKeys(dayPrefix(dayIso))
  const events: VisitEvent[] = []
  for (let i = 0; i < keys.length; i += READ_CONCURRENCY) {
    const batches = await Promise.all(keys.slice(i, i + READ_CONCURRENCY).map(readObject))
    for (const batch of batches) events.push(...batch)
  }
  return { events, keys }
}

export async function clearHeld(keys: readonly string[]): Promise<void> {
  if (keys.length === 0) return
  await deleteObjects(keys)
  for (const key of keys) seen.delete(key)
}

/** Everything waiting for a day, cleared: for a day that was already filed. */
export async function clearHeldDay(dayIso: string): Promise<void> {
  if (!holdingConfigured()) return
  await clearHeld(await listKeys(dayPrefix(dayIso)))
}
