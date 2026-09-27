/**
 * The cart's item count, as the browser last heard it from a cart action.
 *
 * The badge on the header cart and on the bottom tab bar is rendered on the server
 * from the cart cookie, which is httpOnly — so nothing in the browser can read it,
 * and a badge that waits for the page to be re-rendered from the server stays at its
 * old number after "Add to cart". Every cart action now returns the new count, and
 * both badges subscribe here, so they change the moment the cart does.
 *
 * `null` means "nothing heard yet": show what the server rendered.
 */

type Listener = () => void

let count: number | null = null
const listeners = new Set<Listener>()

export function subscribeCartCount(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getCartCount(): number | null {
  return count
}

export function getCartCountServerSnapshot(): number | null {
  return null
}

export function setCartCount(next: number | null): void {
  if (next === count) return
  count = next
  for (const listener of listeners) listener()
}
