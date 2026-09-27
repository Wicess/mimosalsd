/**
 * Open/close state for the chat panel.
 *
 * The same module-level store as the cart drawer (`lib/cart/cart-ui.ts`), for the
 * same reason: the things that open chat — the desktop launcher, the phone's Chat
 * tab, a `?openchat=1` deep link — sit in different parts of the tree, and threading
 * a provider through the layout would turn server chrome into client components.
 *
 * It also solves a race for free. The chat widget is lazy-loaded after the browser
 * goes idle, so a customer can tap the Chat tab BEFORE its code has arrived. The tap
 * sets the flag here; the widget reads the flag the instant it mounts. The tap is
 * delayed by at most the idle window, never dropped.
 */

type Listener = () => void

let open = false
const listeners = new Set<Listener>()

function emit(): void {
  for (const listener of listeners) listener()
}

export function subscribeChatUi(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getChatUiOpen(): boolean {
  return open
}

/** The server never renders the panel open. */
export function getChatUiServerSnapshot(): boolean {
  return false
}

export function openChat(): void {
  if (open) return
  open = true
  emit()
}

export function closeChat(): void {
  if (!open) return
  open = false
  emit()
}
