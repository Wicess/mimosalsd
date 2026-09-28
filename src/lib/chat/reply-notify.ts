/**
 * Reply notifications in the browser, shared by the open chat (a reply arrives while
 * the tab is hidden) and the unread watcher (a reply arrives while the chat is
 * closed). Client-only.
 *
 * The on/off state lives in localStorage plus the browser's permission, and is read
 * through useSyncExternalStore by its callers. Every notification uses the tag
 * 'chat-reply' and carries the chat's address, so a web push for the same reply
 * replaces it instead of showing twice, and tapping it opens the chat (the service
 * worker's notificationclick handler reads `data.url`).
 */

export const NOTIFY_STORAGE_KEY = 'chat-reply-notifications'
export const CHAT_URL = '/account/chat'

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function storedNotificationsOn(): boolean {
  try {
    return notificationsSupported() && Notification.permission === 'granted' && localStorage.getItem(NOTIFY_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

const listeners = new Set<() => void>()
export function subscribeNotify(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
export function emitNotify(): void {
  for (const listener of listeners) listener()
}
export const serverFalse = () => false

/** Show a system notification for a reply. Tapping it opens the chat. */
export async function showReplyNotification(body: string, title = 'New reply from MIMOSALSD'): Promise<void> {
  const options: NotificationOptions = {
    body: body.slice(0, 140) || 'You have a new message.',
    tag: 'chat-reply',
    icon: '/brand/app-icon-v2-192.png',
    badge: '/brand/notification-badge-v2-96.png',
    data: { url: CHAT_URL },
  }
  try {
    // A service worker when there is one: Android refuses the constructor.
    const registration = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined
    if (registration) {
      await registration.showNotification(title, options)
    } else {
      const notification = new Notification(title, options)
      notification.onclick = () => {
        window.focus()
        // Outside React there is no router to push with: a full load of the absolute address.
        window.location.assign(new URL(CHAT_URL, window.location.origin).href)
        notification.close()
      }
    }
  } catch {
    // Blocked or unsupported. The message is still in the chat.
  }
}
