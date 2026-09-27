'use client'

import { useSyncExternalStore } from 'react'
import { detectPlatform, installMethodFor, type DevicePlatform, type InstallMethod } from '@/components/pwa/platform'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  IS THE APP INSTALLED, AND HOW WOULD IT BE — one store for the header button,
 *  the pop-ups and the step-by-step guide, so they can never disagree.
 *
 *  "Installed" is remembered in localStorage and set by every signal a browser
 *  gives: running from the home screen, Chrome's `appinstalled`, an accepted
 *  install dialog, Chrome answering getInstalledRelatedApps(), and — on an
 *  iPhone, which tells a web page nothing — the visitor's own "I've added it".
 *  Once set, the install button and the install pop-up are gone for good.
 *
 *  The one way back: Chrome only offers its install dialog to a site that is NOT
 *  installed, so receiving it clears the flag. Someone who removed the app gets
 *  the button back.
 * ─────────────────────────────────────────────────────────────────────────────
 */

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

declare global {
  interface Window {
    /** Caught by the inline script in app/layout.tsx, before any bundle has loaded. */
    __sgInstallPrompt?: BeforeInstallPromptEvent | null
  }
}

export const INSTALLED_KEY = 'sg-app-installed'

export interface InstallSnapshot {
  readonly ready: boolean
  readonly installed: boolean
  /** Running as the installed app right now. */
  readonly standalone: boolean
  readonly method: InstallMethod
  readonly platform: DevicePlatform | null
  readonly guideOpen: boolean
}

const SERVER: InstallSnapshot = { ready: false, installed: true, standalone: false, method: 'none', platform: null, guideOpen: false }

let snapshot: InstallSnapshot = SERVER
let promptEvent: BeforeInstallPromptEvent | null = null
let started = false
const listeners = new Set<() => void>()

function emit(next: Partial<InstallSnapshot>) {
  snapshot = { ...snapshot, ...next }
  for (const listener of listeners) listener()
}

function readFlag(): boolean {
  try {
    return localStorage.getItem(INSTALLED_KEY) === '1'
  } catch {
    return false
  }
}

function writeFlag(on: boolean) {
  try {
    if (on) localStorage.setItem(INSTALLED_KEY, '1')
    else localStorage.removeItem(INSTALLED_KEY)
  } catch {
    // Storage blocked: remembered for this page only.
  }
}

/**
 * Running from the home screen. `fullscreen` is checked too: on an iPhone, a web
 * app whose manifest says `standalone` matches `fullscreen` instead (WebKit bug
 * 264218), and `navigator.standalone` covers older iOS.
 */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    document.referrer.startsWith('android-app://')
  )
}

function methodNow(platform: DevicePlatform): InstallMethod {
  return installMethodFor(platform, promptEvent !== null)
}

function start() {
  if (started || typeof window === 'undefined') return
  started = true
  const platform = detectPlatform(navigator.userAgent, navigator.maxTouchPoints)
  const standalone = isStandalone()
  if (standalone) writeFlag(true)
  promptEvent = window.__sgInstallPrompt ?? null
  if (promptEvent) writeFlag(false)

  emit({ ready: true, platform, standalone, installed: standalone || readFlag(), method: methodNow(platform) })

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    promptEvent = event as BeforeInstallPromptEvent
    window.__sgInstallPrompt = promptEvent
    writeFlag(false)
    emit({ installed: false, method: methodNow(platform) })
  })
  window.addEventListener('appinstalled', () => markInstalled())

  // Chrome can answer "is this site installed?" from a browser tab (manifest.ts
  // lists the site as its own related application).
  const related = (navigator as Navigator & { getInstalledRelatedApps?: () => Promise<unknown[]> }).getInstalledRelatedApps
  if (!standalone && typeof related === 'function') {
    related
      .call(navigator)
      .then((apps) => {
        if (apps.length > 0) markInstalled()
      })
      .catch(() => {})
  }
}

function subscribe(listener: () => void): () => void {
  start()
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useInstallState(): InstallSnapshot {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => SERVER,
  )
}

export function markInstalled(): void {
  writeFlag(true)
  promptEvent = null
  emit({ installed: true, guideOpen: false, method: snapshot.platform ? installMethodFor(snapshot.platform, false) : 'none' })
}

export function openInstallGuide(): void {
  start()
  emit({ guideOpen: true })
}

export function closeInstallGuide(): void {
  emit({ guideOpen: false })
}

/**
 * Install, the best way this browser allows: its own dialog when there is one,
 * otherwise the step-by-step guide.
 */
export async function startInstall(): Promise<'accepted' | 'dismissed' | 'guide'> {
  start()
  const event = promptEvent
  if (!event) {
    openInstallGuide()
    return 'guide'
  }
  // A dialog can be shown once per event. Chrome sends a fresh event later.
  promptEvent = null
  window.__sgInstallPrompt = null
  try {
    await event.prompt()
    const { outcome } = await event.userChoice
    if (outcome === 'accepted') markInstalled()
    else if (snapshot.platform) emit({ method: methodNow(snapshot.platform) })
    return outcome
  } catch {
    openInstallGuide()
    return 'guide'
  }
}
