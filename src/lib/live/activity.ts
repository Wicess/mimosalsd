/**
 * Is anybody actually here? One answer for the whole page. Browser-only.
 *
 * Every live feature (the customer chat, the unread badge, the admin inbox) asks the
 * same question before it touches the network, so it is answered once, with one set
 * of listeners, instead of each component bolting on its own.
 *
 * "Activity" is a deliberate act: a pointer press, a key, a touch, a wheel turn.
 * NOT `scroll`: an auto-moving carousel or a smooth-scrolling script fires scroll
 * events forever with nobody at the keyboard, and on another site exactly that kept
 * an idle tab polling all day. Not `pointermove` either: a mouse resting on a desk
 * can jitter.
 */

export const IDLE_AFTER_MS = 3 * 60_000

const ACTIVITY = ['pointerdown', 'keydown', 'touchstart', 'wheel'] as const

type WakeListener = { readonly idleMs: number; readonly fn: () => void }

let lastActivity = 0
let attached = false
const wakeListeners = new Set<WakeListener>()
const changeListeners = new Set<() => void>()

function onActivity() {
  const now = Date.now()
  const idleFor = now - lastActivity
  lastActivity = now
  for (const l of [...wakeListeners]) if (idleFor >= l.idleMs) l.fn()
  if (idleFor >= IDLE_AFTER_MS) for (const l of [...changeListeners]) l()
}

function onVisibility() {
  if (document.visibilityState === 'visible') {
    // Coming back to the tab is being here.
    lastActivity = Date.now()
    for (const l of [...wakeListeners]) l.fn()
  }
  for (const l of [...changeListeners]) l()
}

function attach() {
  if (attached || typeof window === 'undefined') return
  attached = true
  // Loading the page counts as being present.
  if (lastActivity === 0) lastActivity = Date.now()
  for (const event of ACTIVITY) window.addEventListener(event, onActivity, { passive: true, capture: true })
  document.addEventListener('visibilitychange', onVisibility)
}

function detachIfUnused() {
  if (!attached || wakeListeners.size > 0 || changeListeners.size > 0) return
  attached = false
  for (const event of ACTIVITY) window.removeEventListener(event, onActivity, { capture: true })
  document.removeEventListener('visibilitychange', onVisibility)
}

export function isVisible(): boolean {
  return typeof document !== 'undefined' && document.visibilityState === 'visible'
}

/** Milliseconds since the last deliberate interaction (or the tab coming back). */
export function idleFor(): number {
  attach()
  return Date.now() - lastActivity
}

/** Visible, and touched within `idleMs`. */
export function isPresent(idleMs: number = IDLE_AFTER_MS): boolean {
  return isVisible() && idleFor() < idleMs
}

/** Treat now as activity (a component that just opened on a tap, say). */
export function markPresent(): void {
  attach()
  lastActivity = Date.now()
}

/**
 * Call `fn` when someone comes back: the tab becomes visible, or the first deliberate
 * interaction after at least `idleMs` without one. That is the moment for a catch-up.
 */
export function onWake(fn: () => void, idleMs: number = IDLE_AFTER_MS): () => void {
  attach()
  const listener = { idleMs, fn }
  wakeListeners.add(listener)
  return () => {
    wakeListeners.delete(listener)
    detachIfUnused()
  }
}

/** Call `fn` when visibility changes, or when activity resumes after the standard idle. */
export function onPresenceChange(fn: () => void): () => void {
  attach()
  changeListeners.add(fn)
  return () => {
    changeListeners.delete(fn)
    detachIfUnused()
  }
}
