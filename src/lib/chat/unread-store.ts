/**
 * How many staff messages the visitor has not read, as the browser last heard it,
 * for the badges on the chat icon, the floating chat button and the profile icon.
 * Client-only.
 *
 * `hasThread` is the one piece that decides whether anything is fetched at all: only
 * a visitor who has a conversation (they opened the chat, or placed an order, whose
 * invoice arrives there) ever checks for unread messages. Everyone else costs the
 * database nothing.
 */

type Listener = () => void

const THREAD_KEY = 'chat-has-thread'
let unread = 0
const listeners = new Set<Listener>()

export function subscribeUnread(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getUnread(): number {
  return unread
}

export const getUnreadServer = () => 0

export function setUnread(next: number): void {
  const value = Math.max(0, Math.floor(next))
  if (value === unread) return
  unread = value
  for (const listener of listeners) listener()
}

export function markHasThread(): void {
  try {
    localStorage.setItem(THREAD_KEY, '1')
  } catch {
    // Private mode: badges simply stay off.
  }
}

export function forgetThread(): void {
  try {
    localStorage.removeItem(THREAD_KEY)
  } catch {
    // Nothing stored.
  }
}

export function hasThread(): boolean {
  try {
    return localStorage.getItem(THREAD_KEY) === '1'
  } catch {
    return false
  }
}
