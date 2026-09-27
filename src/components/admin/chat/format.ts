'use client'

import { useSyncExternalStore } from 'react'

/*
 * Time wording for the inbox, WHAM's. Every function takes `now` rather than reading
 * the clock itself, so rendering stays pure and the labels move on together.
 */

/** "now", "5m", "3h", "Sep 4" — the inbox row. */
export function ageLabel(iso: string, now: number): string {
  const mins = Math.floor((now - Date.parse(iso)) / 60_000)
  if (!Number.isFinite(mins) || mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  if (mins < 60 * 24) return `${Math.floor(mins / 60)}h`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** "Sep 4, 3:12 PM" — receipts and exact timestamps. */
export function exactTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

/** "last seen 5m ago" — or the short form, for a phone header beside a long name. */
export function lastSeen(iso: string | null, now: number, short = false): string {
  if (!iso) return 'away'
  const diff = now - Date.parse(iso)
  if (!Number.isFinite(diff) || diff < 0) return 'away'
  const min = Math.floor(diff / 60_000)
  const unit = min < 1 ? null : min < 60 ? `${min}m` : min < 60 * 24 ? `${Math.floor(min / 60)}h` : `${Math.floor(min / 1440)}d`
  if (short) return unit ?? 'now'
  return unit ? `last seen ${unit} ago` : 'last seen just now'
}

export function dayLabel(iso: string, now: number): string {
  const date = new Date(iso)
  const today = new Date(now)
  const yesterday = new Date(now)
  yesterday.setDate(today.getDate() - 1)
  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

/** Two letters for an avatar. A handle like "SG-7K3M9" gives "7K", never "SG". */
export function initials(name: string): string {
  const cleaned = name.replace(/^SG-/, '').trim()
  const words = cleaned.split(/\s+/).filter(Boolean)
  if (words.length >= 2) return `${words[0]![0]}${words[1]![0]}`.toUpperCase()
  return cleaned.slice(0, 2).toUpperCase() || '?'
}

/*
 * A shared clock for relative labels. One interval for the whole inbox, only while
 * something is subscribed, and it touches nothing but the screen — no network.
 */
let clock = 0
let clockTimer: number | undefined
const clockListeners = new Set<() => void>()

function subscribeClock(listener: () => void) {
  clockListeners.add(listener)
  if (clockTimer === undefined) {
    clock = Date.now()
    clockTimer = window.setInterval(() => {
      clock = Date.now()
      for (const l of clockListeners) l()
    }, 30_000)
  }
  return () => {
    clockListeners.delete(listener)
    if (clockListeners.size === 0 && clockTimer !== undefined) {
      window.clearInterval(clockTimer)
      clockTimer = undefined
    }
  }
}

function clockSnapshot() {
  if (clock === 0) clock = Date.now()
  return clock
}

/** The current time, refreshed every 30 seconds. 0 on the server. */
export function useNow(): number {
  return useSyncExternalStore(subscribeClock, clockSnapshot, () => 0)
}

/*
 * A remembered on/off preference (the typing preview, the profile column), read
 * through useSyncExternalStore so the stored value arrives without a
 * set-state-in-effect, and survives private mode by falling back to the default.
 */
const prefListeners = new Set<() => void>()

function subscribePrefs(listener: () => void) {
  prefListeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    prefListeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

function readPref(key: string, fallback: boolean): boolean {
  try {
    const v = window.localStorage.getItem(key)
    return v === null ? fallback : v === '1'
  } catch {
    return fallback
  }
}

export function usePref(key: string, fallback: boolean): [boolean, (next: boolean) => void] {
  const value = useSyncExternalStore(subscribePrefs, () => readPref(key, fallback), () => fallback)
  const set = (next: boolean) => {
    try {
      window.localStorage.setItem(key, next ? '1' : '0')
    } catch {
      // Private mode: the choice lasts this page view only.
    }
    for (const l of prefListeners) l()
  }
  return [value, set]
}
