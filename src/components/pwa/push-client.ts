'use client'

import { useSyncExternalStore } from 'react'
import { detectPlatform } from '@/components/pwa/platform'
import { isStandalone } from '@/components/pwa/install-store'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  PUSH NOTIFICATIONS, FROM THE BROWSER'S SIDE.
 *
 *  `enablePushNotifications()` is the one call: it asks permission, subscribes
 *  this browser with the site's key, and hands the subscription to the server,
 *  which can then reach the phone with the site closed. Call it straight from a
 *  tap: Safari and Chrome only show the permission dialog in response to one,
 *  which is why the key and the service worker are fetched ahead of time by
 *  `preparePush()` — an await on the network between the tap and the request
 *  can cost the gesture on Safari.
 *
 *  On an iPhone this only exists inside the installed app (iOS 16.4+); in a
 *  Safari tab the answer is "needs-install", and the install guide comes first.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type PushStatus = 'unknown' | 'unsupported' | 'needs-install' | 'default' | 'denied' | 'subscribed'

/** Also read by the chat's in-page reply alerts (components/chat/use-chat.ts). */
const CHAT_NOTIFY_KEY = 'chat-reply-notifications'
const SYNCED_KEY = 'sg-push-synced'

let status: PushStatus = 'unknown'
const listeners = new Set<() => void>()
function setStatus(next: PushStatus) {
  if (next === status) return
  status = next
  for (const listener of listeners) listener()
}

function notificationsWanted(): boolean {
  try {
    return localStorage.getItem(CHAT_NOTIFY_KEY) === '1'
  } catch {
    return false
  }
}

function supported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

function needsInstallFirst(): boolean {
  if (typeof window === 'undefined') return false
  const platform = detectPlatform(navigator.userAgent, navigator.maxTouchPoints)
  return platform.os === 'ios' && !isStandalone()
}

/** The service worker, or null if it is not registered within a few seconds. */
function registration(timeoutMs = 4000): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return Promise.resolve(null)
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => window.setTimeout(() => resolve(null), timeoutMs)),
  ])
}

let prepared: Promise<{ key: Uint8Array; registration: ServiceWorkerRegistration } | null> | null = null

/** Fetch the key and wait for the worker now, so the tap has nothing left to wait for. */
export function preparePush(): Promise<{ key: Uint8Array; registration: ServiceWorkerRegistration } | null> {
  if (!supported()) return Promise.resolve(null)
  prepared ??= (async () => {
    const [response, reg] = await Promise.all([
      fetch('/api/push/subscribe', { credentials: 'same-origin' }).catch(() => null),
      registration(),
    ])
    if (!response?.ok || !reg) return null
    const { publicKey } = (await response.json()) as { publicKey: string }
    return { key: keyBytes(publicKey), registration: reg }
  })().then((value) => {
    if (!value) prepared = null
    return value
  })
  return prepared
}

function keyBytes(base64url: string): Uint8Array {
  const padded = (base64url + '==='.slice((base64url.length + 3) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))
}

function sameKey(subscription: PushSubscription, key: Uint8Array): boolean {
  const current = subscription.options?.applicationServerKey
  if (!current) return true
  const bytes = new Uint8Array(current)
  return bytes.length === key.length && bytes.every((b, i) => b === key[i])
}

async function save(subscription: PushSubscription): Promise<boolean> {
  const platform = detectPlatform(navigator.userAgent, navigator.maxTouchPoints)
  const response = await fetch('/api/push/subscribe', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...subscription.toJSON(), installed: isStandalone(), platform: platform.os }),
  }).catch(() => null)
  return Boolean(response?.ok)
}

/** Work out where this browser stands, without asking anything. */
export async function refreshPushStatus(): Promise<PushStatus> {
  if (!supported()) {
    setStatus(needsInstallFirst() ? 'needs-install' : 'unsupported')
    return status
  }
  if (Notification.permission === 'denied') {
    setStatus('denied')
    return status
  }
  // Generous: on a first visit the worker registers after the page loads, and an
  // answer of "not subscribed" given too early would ask someone who already is.
  // The prompts wait 10 seconds anyway, so there is time.
  const reg = await registration(8000)
  const existing = reg ? await reg.pushManager.getSubscription().catch(() => null) : null
  setStatus(existing && Notification.permission === 'granted' ? 'subscribed' : needsInstallFirst() ? 'needs-install' : 'default')
  return status
}

/**
 * Keep an existing subscription current: once a session, re-send it (the server
 * links it to this visitor and notes it is still alive), and if permission is
 * still granted but the browser dropped the subscription, quietly make a new one.
 */
export async function syncPushSubscription(): Promise<void> {
  if (!supported() || Notification.permission !== 'granted') return
  try {
    if (sessionStorage.getItem(SYNCED_KEY) === '1') return
  } catch {
    // Storage blocked: sync every page, which is harmless.
  }
  const ready = await preparePush()
  if (!ready) return
  let subscription = await ready.registration.pushManager.getSubscription().catch(() => null)
  // Re-create a dropped subscription only for someone who turned notifications ON and
  // never off. The browser permission alone is not that: it outlives "Turn off", and
  // the chat's in-page alerts ask for it too.
  if (!subscription && !notificationsWanted()) return
  if (!subscription) {
    subscription = await ready.registration.pushManager
      .subscribe({ userVisibleOnly: true, applicationServerKey: ready.key as BufferSource })
      .catch(() => null)
  }
  if (subscription && (await save(subscription))) {
    try {
      sessionStorage.setItem(SYNCED_KEY, '1')
    } catch {
      // Ignore.
    }
    setStatus('subscribed')
  }
}

export type EnableResult = 'subscribed' | 'denied' | 'dismissed' | 'needs-install' | 'unsupported' | 'error'

export async function enablePushNotifications(): Promise<EnableResult> {
  if (!supported()) {
    const result = needsInstallFirst() ? 'needs-install' : 'unsupported'
    setStatus(result)
    return result
  }
  // Asked FIRST, synchronously inside the tap, before any await: that is the order
  // Apple documents for web apps, and Chrome accepts it too. Subscribing afterwards
  // needs no gesture once permission is granted.
  const asked = Notification.permission === 'default' ? Notification.requestPermission() : Promise.resolve(Notification.permission)
  const permission = await asked.catch(() => Notification.permission)
  if (permission === 'denied') {
    setStatus('denied')
    return 'denied'
  }
  // Closed the dialog without choosing: nothing is decided, so it can be asked again.
  if (permission !== 'granted') return 'dismissed'

  const ready = await preparePush()
  if (!ready) return 'error'
  try {
    let subscription = await ready.registration.pushManager.getSubscription()
    if (subscription && !sameKey(subscription, ready.key)) {
      await subscription.unsubscribe()
      subscription = null
    }
    subscription ??= await ready.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: ready.key as BufferSource,
    })
    if (!(await save(subscription))) return 'error'
  } catch {
    return 'error'
  }

  setStatus('subscribed')
  try {
    localStorage.setItem(CHAT_NOTIFY_KEY, '1')
    sessionStorage.setItem(SYNCED_KEY, '1')
  } catch {
    // Ignore.
  }
  // The admin's visitor timeline shows this milestone.
  void fetch('/api/visits/activity', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind: 'NOTIFICATIONS_ENABLED', path: window.location.pathname }),
    keepalive: true,
  }).catch(() => {})
  return 'subscribed'
}

export async function disablePushNotifications(): Promise<void> {
  const reg = await registration(2500)
  const subscription = reg ? await reg.pushManager.getSubscription().catch(() => null) : null
  if (subscription) {
    await fetch('/api/push/subscribe', {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    }).catch(() => null)
    await subscription.unsubscribe().catch(() => false)
  }
  try {
    localStorage.removeItem(CHAT_NOTIFY_KEY)
  } catch {
    // Ignore.
  }
  setStatus(Notification.permission === 'denied' ? 'denied' : 'default')
}

export function usePushStatus(): PushStatus {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      if (status === 'unknown') void refreshPushStatus()
      return () => listeners.delete(listener)
    },
    () => status,
    () => 'unknown' as const,
  )
}
